/**
 * Self-healing table bootstrap for the job system (+ free-launch badge checks).
 *
 * The tables are declared in prisma/schema.prisma (and created by
 * `prisma db push` / the 20261015000000_jobs_badges_revenue_outbound migration). This is
 * a safety net: if a deploy ships before the schema is pushed, the first
 * tick creates the tables instead of every background job failing. The DDL
 * mirrors Prisma's output exactly so a later `db push` sees no drift.
 */

import { prisma } from "@/lib/db";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "JobQueue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "dedupeKey" TEXT,
    "lastError" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "JobQueue_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "CronState" (
    "name" TEXT NOT NULL,
    "lastSlot" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CronState_pkey" PRIMARY KEY ("name")
  )`,
  `CREATE TABLE IF NOT EXISTS "BadgeVerification" (
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BadgeVerification_pkey" PRIMARY KEY ("domain")
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "JobQueue_dedupeKey_key" ON "JobQueue"("dedupeKey")`,
  `CREATE INDEX IF NOT EXISTS "JobQueue_status_runAt_idx" ON "JobQueue"("status", "runAt")`,
  `CREATE INDEX IF NOT EXISTS "JobQueue_name_createdAt_idx" ON "JobQueue"("name", "createdAt")`,
];

let ready: Promise<void> | null = null;

export function ensureJobTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const exists = await prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT (to_regclass('"JobQueue"') IS NOT NULL AND to_regclass('"CronState"') IS NOT NULL
                AND to_regclass('"BadgeVerification"') IS NOT NULL) AS ok`;
      if (exists[0]?.ok) return;
      for (const stmt of DDL) await prisma.$executeRawUnsafe(stmt);
      console.info("[jobs] created JobQueue / CronState tables");
    })().catch((err) => {
      ready = null; // retry on the next call
      throw err;
    });
  }
  return ready;
}

let revenueColumnsReady: Promise<void> | null = null;

/** Columns added to RevenueConnection by the revenue-verification rewrite. */
export function ensureRevenueColumns(): Promise<void> {
  if (!revenueColumnsReady) {
    revenueColumnsReady = (async () => {
      await prisma.$executeRawUnsafe(`ALTER TABLE "RevenueConnection" ADD COLUMN IF NOT EXISTS "keyHint" TEXT NOT NULL DEFAULT ''`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "RevenueConnection" ADD COLUMN IF NOT EXISTS "sourceCurrency" TEXT NOT NULL DEFAULT 'USD'`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "RevenueConnection" ADD COLUMN IF NOT EXISTS "verificationMethod" TEXT`);
    })().catch((err) => {
      revenueColumnsReady = null;
      throw err;
    });
  }
  return revenueColumnsReady;
}

/* Outbound click tracking (lib/outbound). Mirrors `prisma db push` output. */
const OUTBOUND_DDL = [
  `CREATE TABLE IF NOT EXISTS "OutboundClick" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "referrerHost" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastClickAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutboundClick_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "OutboundClickDaily" (
    "productId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutboundClickDaily_pkey" PRIMARY KEY ("productId","day","source")
  )`,
  `CREATE INDEX IF NOT EXISTS "OutboundClick_day_idx" ON "OutboundClick"("day")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "OutboundClick_productId_day_source_visitorHash_key" ON "OutboundClick"("productId", "day", "source", "visitorHash")`,
  `CREATE INDEX IF NOT EXISTS "OutboundClickDaily_day_idx" ON "OutboundClickDaily"("day")`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutboundClick_productId_fkey') THEN
       ALTER TABLE "OutboundClick" ADD CONSTRAINT "OutboundClick_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutboundClickDaily_productId_fkey') THEN
       ALTER TABLE "OutboundClickDaily" ADD CONSTRAINT "OutboundClickDaily_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
];

let outboundReady: Promise<void> | null = null;

export function ensureOutboundTables(): Promise<void> {
  if (!outboundReady) {
    outboundReady = (async () => {
      const exists = await prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT (to_regclass('"OutboundClick"') IS NOT NULL AND to_regclass('"OutboundClickDaily"') IS NOT NULL) AS ok`;
      if (exists[0]?.ok) return;
      for (const stmt of OUTBOUND_DDL) await prisma.$executeRawUnsafe(stmt);
      console.info("[outbound] created OutboundClick / OutboundClickDaily tables");
    })().catch((err) => {
      outboundReady = null;
      throw err;
    });
  }
  return outboundReady;
}
