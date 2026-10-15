/**
 * Scheduler — turns "every N minutes" into exactly one queued job per slot.
 *
 * A slot is `floor(now / interval) * interval` (UTC-aligned, so the 6-hour
 * indexing sync lands on 00/06/12/18 UTC exactly like the old Inngest cron).
 * Each tick enqueues one job per task with dedupeKey `cron:<task>:<slot>`,
 * so any number of overlapping heartbeats still run a slot exactly once,
 * and a heartbeat that arrives late simply runs the current slot.
 *
 * Heartbeat sources (any one is enough; all are safe together):
 *   1. /api/cron           — Cloudflare Worker cron, GitHub Actions, Vercel cron, any pinger
 *   2. visitor traffic     — `heartbeat()` piggybacks on /api/layout-data after the response
 *   3. in-process timer    — instrumentation.ts on long-running Node servers / local dev
 */

import { prisma } from "@/lib/db";
import { drainQueue, enqueue, type DrainResult } from "./queue";
import { ensureJobTables } from "./schema";
import type { JobName } from "./events";

const MIN = 60_000;
const HOUR = 60 * MIN;

export const CRON_TASKS: Array<{ job: JobName; everyMs: number; description: string }> = [
  { job: "cron.publish-due", everyMs: MIN, description: "Publish submissions whose launch time has passed" },
  { job: "cron.leaderboard", everyMs: 5 * MIN, description: "Sync live ranks, close cycles, award & announce winners" },
  { job: "cron.indexing-sync", everyMs: 6 * HOUR, description: "Submit fresh URLs to Google Indexing API & IndexNow" },
  { job: "cron.outreach", everyMs: 4 * HOUR, description: "Send the automated directory outreach batch" },
  { job: "cron.directory-crawler", everyMs: HOUR, description: "Crawl saved directories once a day after the set hour" },
  { job: "cron.revenue-sync", everyMs: HOUR, description: "Re-verify connected payment providers; un-verify revoked keys" },
  { job: "cron.badge-audit", everyMs: 6 * HOUR, description: "Re-check free launches still show our badge (else nofollow)" },
  { job: "cron.outbound-rollup", everyMs: HOUR, description: "Roll up outbound clicks per day; prune raw clicks after 14 days" },
  { job: "cron.cleanup", everyMs: 24 * HOUR, description: "Prune finished job rows" },
];

function slotOf(now: number, everyMs: number) {
  return new Date(Math.floor(now / everyMs) * everyMs);
}

/** Enqueue every task whose current slot has not been queued yet. */
export async function scheduleDueCrons(now = new Date()) {
  await ensureJobTables();
  const ms = now.getTime();
  await Promise.all(
    CRON_TASKS.map(({ job, everyMs }) => {
      const slot = slotOf(ms, everyMs).toISOString();
      return enqueue(job, { slot }, { dedupeKey: `cron:${job}:${slot}`, maxAttempts: 2 });
    })
  );
}

export interface TickResult {
  ok: boolean;
  source: string;
  startedAt: string;
  durationMs: number;
  drained: DrainResult;
}

/** One full scheduler pass: queue due cron slots, then work the queue. */
export async function tick(source: string, budgetMs = 45_000): Promise<TickResult> {
  const started = Date.now();
  await scheduleDueCrons();
  const drained = await drainQueue({ budgetMs });
  const now = new Date();
  await prisma.cronState
    .upsert({
      where: { name: "__tick" },
      create: { name: "__tick", lastRunAt: now, lastStatus: source, runCount: 1 },
      update: { lastRunAt: now, lastStatus: source, runCount: { increment: 1 } },
    })
    .catch(() => {});
  return { ok: true, source, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, drained };
}

/* ─────────── traffic heartbeat ─────────── */

const HEARTBEAT_EVERY_MS = 55_000;
let lastLocalBeat = 0;

/**
 * Cheap, throttled tick for hot paths. At most one per ~minute per instance
 * (in-memory) and one per ~minute across all instances (conditional upsert),
 * so it costs a single indexed UPDATE on the requests that win the race and
 * nothing on the rest.
 */
export async function heartbeat(source = "traffic"): Promise<TickResult | null> {
  if (process.env.JOBS_DISABLED === "true") return null;
  if (process.env.NEXT_PHASE === "phase-production-build") return null;
  const nowMs = Date.now();
  if (nowMs - lastLocalBeat < HEARTBEAT_EVERY_MS) return null;
  lastLocalBeat = nowMs;

  await ensureJobTables();
  const now = new Date(nowMs);
  const threshold = new Date(nowMs - HEARTBEAT_EVERY_MS);
  const won = await prisma.$queryRaw<{ name: string }[]>`
    INSERT INTO "CronState" ("name", "lastRunAt", "lastStatus", "runCount", "updatedAt")
    VALUES ('__heartbeat', ${now}, ${source}, 1, ${now})
    ON CONFLICT ("name") DO UPDATE
       SET "lastRunAt" = EXCLUDED."lastRunAt",
           "lastStatus" = EXCLUDED."lastStatus",
           "runCount" = "CronState"."runCount" + 1,
           "updatedAt" = EXCLUDED."updatedAt"
     WHERE "CronState"."lastRunAt" IS NULL OR "CronState"."lastRunAt" < ${threshold}
    RETURNING "name"`;
  if (won.length === 0) return null;
  return tick(source, 25_000);
}

/* ─────────── status (admin) ─────────── */

export async function getSchedulerStatus() {
  await ensureJobTables();
  const [states, counts, recentFailures, lastByJob] = await Promise.all([
    prisma.cronState.findMany({ where: { name: { in: ["__tick", "__heartbeat"] } } }),
    prisma.jobQueue.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.jobQueue.findMany({
      where: { status: "FAILED" },
      orderBy: { finishedAt: "desc" },
      take: 10,
      select: { id: true, name: true, lastError: true, attempts: true, finishedAt: true },
    }),
    Promise.all(
      CRON_TASKS.map((t) =>
        prisma.jobQueue.findFirst({
          where: { name: t.job, status: { in: ["DONE", "FAILED"] } },
          orderBy: { finishedAt: "desc" },
          select: { status: true, finishedAt: true, lastError: true, result: true },
        })
      )
    ),
  ]);
  const tickState = states.find((s) => s.name === "__tick");
  const beatState = states.find((s) => s.name === "__heartbeat");
  const lastBeat = [tickState?.lastRunAt, beatState?.lastRunAt]
    .filter(Boolean)
    .map((d) => (d as Date).getTime())
    .sort((a, b) => b - a)[0];
  return {
    lastTickAt: lastBeat ? new Date(lastBeat).toISOString() : null,
    lastTickSource: tickState?.lastStatus ?? null,
    healthy: lastBeat ? Date.now() - lastBeat < 10 * MIN : false,
    queue: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>,
    tasks: CRON_TASKS.map((t, i) => ({
      job: t.job,
      everyMinutes: t.everyMs / MIN,
      description: t.description,
      lastStatus: lastByJob[i]?.status ?? null,
      lastFinishedAt: lastByJob[i]?.finishedAt?.toISOString() ?? null,
      lastError: lastByJob[i]?.lastError ?? null,
    })),
    recentFailures,
  };
}
