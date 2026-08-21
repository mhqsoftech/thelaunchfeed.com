-- Add monthly/daily revenue history buckets to RevenueConnection so the
-- Verified Revenue chart can render exact month-over-month (and day-over-day)
-- revenue instead of dumping the full total into the current month.
ALTER TABLE "RevenueConnection"
  ADD COLUMN "monthlyHistoryJson" JSONB,
  ADD COLUMN "dailyHistoryJson"   JSONB;
