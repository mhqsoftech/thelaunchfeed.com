-- ─────────────────────────────────────────────────────────────────────────────
-- Self-hosted jobs, free-launch badges, revenue verification, outbound clicks.
--
-- This project syncs production with `npm run db:push` (the migration history
-- is not used for deploys); this file is the reviewable record of the change
-- and can also be pasted into the Neon SQL Editor. Purely additive and safe to
-- re-run: every statement is IF NOT EXISTS, policies are dropped then created.
--
--   1. RevenueConnection: keyHint, sourceCurrency, verificationMethod
--   2. JobQueue + CronState: durable job queue (lib/jobs, replaces Inngest)
--   3. BadgeVerification: free-launch badge checks (lib/free-launch.ts)
--   4. OutboundClick + OutboundClickDaily: "visitors sent" (lib/outbound)
--   5. Row level security on the new tables — admins + server context only,
--      same shape as AppSetting in 20260818200000_enable_row_level_security.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. RevenueConnection
ALTER TABLE "RevenueConnection" ADD COLUMN IF NOT EXISTS "keyHint" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RevenueConnection" ADD COLUMN IF NOT EXISTS "sourceCurrency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "RevenueConnection" ADD COLUMN IF NOT EXISTS "verificationMethod" TEXT;

-- 2. Job queue
CREATE TABLE IF NOT EXISTS "JobQueue" (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobQueue_dedupeKey_key" ON "JobQueue"("dedupeKey");
CREATE INDEX IF NOT EXISTS "JobQueue_status_runAt_idx" ON "JobQueue"("status", "runAt");
CREATE INDEX IF NOT EXISTS "JobQueue_name_createdAt_idx" ON "JobQueue"("name", "createdAt");

CREATE TABLE IF NOT EXISTS "CronState" (
    "name" TEXT NOT NULL,
    "lastSlot" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CronState_pkey" PRIMARY KEY ("name")
);

-- 3. Badge verification
CREATE TABLE IF NOT EXISTS "BadgeVerification" (
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BadgeVerification_pkey" PRIMARY KEY ("domain")
);

-- 4. Outbound click tracking
CREATE TABLE IF NOT EXISTS "OutboundClick" (
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
);
CREATE INDEX IF NOT EXISTS "OutboundClick_day_idx" ON "OutboundClick"("day");
CREATE UNIQUE INDEX IF NOT EXISTS "OutboundClick_productId_day_source_visitorHash_key" ON "OutboundClick"("productId", "day", "source", "visitorHash");

CREATE TABLE IF NOT EXISTS "OutboundClickDaily" (
    "productId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutboundClickDaily_pkey" PRIMARY KEY ("productId", "day", "source")
);
CREATE INDEX IF NOT EXISTS "OutboundClickDaily_day_idx" ON "OutboundClickDaily"("day");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutboundClick_productId_fkey') THEN
    ALTER TABLE "OutboundClick" ADD CONSTRAINT "OutboundClick_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutboundClickDaily_productId_fkey') THEN
    ALTER TABLE "OutboundClickDaily" ADD CONSTRAINT "OutboundClickDaily_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Row level security. The app connects as the table owner, which bypasses
--    RLS; these policies only restrict user-scoped access (e.g. Neon Data API
--    JWTs). Skipped when the RLS helper functions are not installed.
DO $$
DECLARE t text;
BEGIN
  IF to_regproc('app_is_admin') IS NULL OR to_regproc('app_current_user_id') IS NULL THEN
    RAISE NOTICE 'RLS helper functions missing; skipping policies';
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY['JobQueue', 'CronState', 'BadgeVerification', 'OutboundClick', 'OutboundClickDaily'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(t) || '_admin_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(t) || '_server_bypass', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (app_is_admin())', lower(t) || '_admin_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (app_current_user_id() IS NULL)', lower(t) || '_server_bypass', t);
  END LOOP;
END $$;
