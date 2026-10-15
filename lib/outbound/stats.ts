/**
 * Daily rollup, retention and the per-product "visitors sent" report.
 *
 * Raw OutboundClick rows are kept RAW_RETENTION_DAYS; a day is folded into
 * OutboundClickDaily and its raw rows deleted in one transaction, so no day
 * is ever half-counted. Reports read raw rows where they still exist and the
 * rollup otherwise.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureOutboundTables } from "@/lib/jobs/schema";
import { SENT_SOURCES, type OutboundSource } from "./links";
import { utcDay } from "./track";

export const RAW_RETENTION_DAYS = 14;
const DAY_MS = 24 * 60 * 60_000;

function shiftDay(day: string, delta: number) {
  return utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS));
}

const SENT_SQL = Prisma.join(SENT_SOURCES.map((s) => Prisma.sql`${s}`));

/** Upsert rollup rows for raw days in [from, to]. "all" = distinct visitors
 *  across the placements that send traffic out (badge clicks excluded). */
async function rollupRange(db: Prisma.TransactionClient | typeof prisma, from: string, to: string) {
  return db.$executeRaw`
    INSERT INTO "OutboundClickDaily" ("productId", "day", "source", "visitors", "clicks", "updatedAt")
    SELECT "productId", "day", "source", COUNT(*)::int, SUM("clicks")::int, NOW()
      FROM "OutboundClick"
     WHERE "day" BETWEEN ${from}::date AND ${to}::date
     GROUP BY "productId", "day", "source"
    UNION ALL
    SELECT "productId", "day", 'all', COUNT(DISTINCT "visitorHash")::int, SUM("clicks")::int, NOW()
      FROM "OutboundClick"
     WHERE "day" BETWEEN ${from}::date AND ${to}::date AND "source" IN (${SENT_SQL})
     GROUP BY "productId", "day"
    ON CONFLICT ("productId", "day", "source") DO UPDATE
       SET "visitors" = EXCLUDED."visitors", "clicks" = EXCLUDED."clicks", "updatedAt" = EXCLUDED."updatedAt"`;
}

/** Hourly job: refresh the last 3 days, then fold + prune expired raw days. */
export async function rollupAndPrune(now = new Date()) {
  await ensureOutboundTables();
  const today = utcDay(now);
  const refreshed = await rollupRange(prisma, shiftDay(today, -2), today);
  const cutoff = shiftDay(today, -(RAW_RETENTION_DAYS - 1)); // oldest raw day we keep
  const pruned = await prisma.$transaction(async (tx) => {
    await rollupRange(tx, "2000-01-01", shiftDay(cutoff, -1));
    return tx.$executeRaw`DELETE FROM "OutboundClick" WHERE "day" < ${cutoff}::date`;
  });
  return { refreshedRows: refreshed, prunedRawRows: pruned };
}

/* ─────────── report ─────────── */

export type VisitorStats = {
  /** Oldest → newest, one entry per UTC day (30 days). */
  daily: Array<{ day: string; visitors: number }>;
  last7: number;
  last30: number;
  clicks30: number;
  /** Visitors per placement over 30 days (sent placements only). */
  bySource: Partial<Record<OutboundSource, number>>;
  /** Visitors your embedded badge brought to your product page (30 days). */
  badgeVisitors30: number;
};

type Row = { productId: string; day: string; source: string; visitors: number; clicks: number };

export async function getVisitorStats(productIds: string[], now = new Date()): Promise<Record<string, VisitorStats>> {
  const out: Record<string, VisitorStats> = {};
  if (productIds.length === 0) return out;
  await ensureOutboundTables();

  const today = utcDay(now);
  const from = shiftDay(today, -29);
  const days = Array.from({ length: 30 }, (_, i) => shiftDay(from, i));

  const [raw, rolled] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT "productId", to_char("day", 'YYYY-MM-DD') AS "day", "source",
             COUNT(*)::int AS "visitors", SUM("clicks")::int AS "clicks"
        FROM "OutboundClick"
       WHERE "productId" IN (${Prisma.join(productIds)}) AND "day" >= ${from}::date
       GROUP BY 1, 2, 3
      UNION ALL
      SELECT "productId", to_char("day", 'YYYY-MM-DD'), 'all',
             COUNT(DISTINCT "visitorHash")::int, SUM("clicks")::int
        FROM "OutboundClick"
       WHERE "productId" IN (${Prisma.join(productIds)}) AND "day" >= ${from}::date AND "source" IN (${SENT_SQL})
       GROUP BY 1, 2`,
    prisma.$queryRaw<Row[]>`
      SELECT "productId", to_char("day", 'YYYY-MM-DD') AS "day", "source", "visitors", "clicks"
        FROM "OutboundClickDaily"
       WHERE "productId" IN (${Prisma.join(productIds)}) AND "day" >= ${from}::date`,
  ]);

  // Raw rows are authoritative for any day they still exist on.
  const rawDays = new Set(raw.map((r) => `${r.productId}|${r.day}`));
  const rows = [...raw, ...rolled.filter((r) => !rawDays.has(`${r.productId}|${r.day}`))];

  for (const id of productIds) {
    out[id] = { daily: days.map((day) => ({ day, visitors: 0 })), last7: 0, last30: 0, clicks30: 0, bySource: {}, badgeVisitors30: 0 };
  }
  const index = new Map(days.map((d, i) => [d, i]));
  const weekStart = shiftDay(today, -6);
  for (const r of rows) {
    const s = out[r.productId];
    const i = index.get(r.day);
    if (!s || i === undefined) continue;
    if (r.source === "all") {
      s.daily[i].visitors += r.visitors;
      s.last30 += r.visitors;
      s.clicks30 += r.clicks;
      if (r.day >= weekStart) s.last7 += r.visitors;
    } else if (r.source === "badge") {
      s.badgeVisitors30 += r.visitors;
    } else {
      const src = r.source as OutboundSource;
      s.bySource[src] = (s.bySource[src] ?? 0) + r.visitors;
    }
  }
  return out;
}
