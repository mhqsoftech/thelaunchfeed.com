/**
 * Release Schedule Engine for The Launch Feed.
 * Standardizes daily releases & leaderboard cycles at 6:00 AM IST (00:30 UTC).
 */

const IST_OFFSET_MINUTES = 330; // +05:30 (5 hours 30 mins)

/**
 * Calculates the exact upcoming 6:00 AM IST (00:30 UTC) release slot.
 * - 6:00 AM IST is exactly 00:30:00.000 UTC.
 * - If current time < today at 00:30:00.000 UTC, next release is today at 00:30:00.000 UTC.
 * - If current time >= today at 00:30:00.000 UTC, next release is tomorrow at 00:30:00.000 UTC.
 */
export function getNext6AmIstRelease(from: Date = new Date()): Date {
  const target = new Date(from.getTime());
  target.setUTCHours(0, 30, 0, 0);

  if (from.getTime() >= target.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target;
}

export interface CycleRange {
  start: Date;
  end: Date;
  key: string;
  label: string;
}

/**
 * Calculates the active Daily 24-Hour Cycle Range in UTC (aligned to 6:00 AM IST).
 * - Start: most recent 00:30 UTC (6:00 AM IST).
 * - End: next upcoming 00:30 UTC (6:00 AM IST next day).
 */
export function getDailyCycleRange(from: Date = new Date()): CycleRange {
  const start = new Date(from.getTime());
  start.setUTCHours(0, 30, 0, 0);

  // If `from` is before 00:30 UTC, current cycle started yesterday at 00:30 UTC
  if (from.getTime() < start.getTime()) {
    start.setUTCDate(start.getUTCDate() - 1);
  }

  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 1);

  // Key in IST date representation (e.g. "2026-08-17")
  const istDate = new Date(start.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const key = istDate.toISOString().slice(0, 10);

  return {
    start,
    end,
    key,
    label: `Daily Drop (${key})`,
  };
}

/**
 * Calculates the previously completed Daily 24-Hour Cycle Range (for award evaluation & broadcast).
 */
export function getPreviousDailyCycleRange(from: Date = new Date()): CycleRange {
  const current = getDailyCycleRange(from);
  const start = new Date(current.start.getTime());
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(current.start.getTime());

  const istDate = new Date(start.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const key = istDate.toISOString().slice(0, 10);

  return {
    start,
    end,
    key,
    label: `Daily Drop (${key})`,
  };
}

/**
 * Calculates the active Weekly Cycle Range aligned with Monday 6:00 AM IST (00:30 UTC).
 */
export function getWeeklyCycleRange(from: Date = new Date()): CycleRange {
  const daily = getDailyCycleRange(from);
  const istDate = new Date(daily.start.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  
  // Day of week: 0 is Sunday, 1 is Monday ... 6 is Saturday
  const day = istDate.getUTCDay();
  const diffToMonday = (day + 6) % 7; // 0 if Monday, 1 if Tuesday, 6 if Sunday

  const start = new Date(daily.start.getTime());
  start.setUTCDate(start.getUTCDate() - diffToMonday);

  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 7);

  // ISO week calculation
  const target = new Date(start.getTime());
  target.setUTCDate(target.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+target - +yearStart) / 86400000 + 1) / 7);
  const key = `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;

  return {
    start,
    end,
    key,
    label: `Weekly (${key})`,
  };
}

/**
 * Calculates the previously completed Weekly Cycle Range.
 */
export function getPreviousWeeklyCycleRange(from: Date = new Date()): CycleRange {
  const current = getWeeklyCycleRange(from);
  const start = new Date(current.start.getTime());
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(current.start.getTime());

  const target = new Date(start.getTime());
  target.setUTCDate(target.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+target - +yearStart) / 86400000 + 1) / 7);
  const key = `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;

  return {
    start,
    end,
    key,
    label: `Weekly (${key})`,
  };
}

/**
 * Calculates the active Monthly Cycle Range aligned to 1st of Month 6:00 AM IST (00:30 UTC).
 */
export function getMonthlyCycleRange(from: Date = new Date()): CycleRange {
  const daily = getDailyCycleRange(from);
  const istDate = new Date(daily.start.getTime() + IST_OFFSET_MINUTES * 60 * 1000);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth(); // 0-indexed

  // 1st of month in UTC at 00:30:00.000
  const start = new Date(Date.UTC(year, month, 1, 0, 30, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 30, 0, 0));

  const key = `${year}-${String(month + 1).padStart(2, "0")}`;

  return {
    start,
    end,
    key,
    label: `Monthly (${key})`,
  };
}

/**
 * Calculates the previously completed Monthly Cycle Range.
 */
export function getPreviousMonthlyCycleRange(from: Date = new Date()): CycleRange {
  const current = getMonthlyCycleRange(from);
  const end = new Date(current.start.getTime());
  const startYear = end.getUTCFullYear();
  const startMonth = end.getUTCMonth() - 1;
  const start = new Date(Date.UTC(startYear, startMonth, 1, 0, 30, 0, 0));
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end, key, label: `Monthly (${key})` };
}

/**
 * Calculates the active Yearly Cycle Range aligned to Jan 1st 6:00 AM IST (00:30 UTC).
 */
export function getYearlyCycleRange(from: Date = new Date()): CycleRange {
  const daily = getDailyCycleRange(from);
  const istDate = new Date(daily.start.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const year = istDate.getUTCFullYear();

  const start = new Date(Date.UTC(year, 0, 1, 0, 30, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 30, 0, 0));

  const key = String(year);

  return {
    start,
    end,
    key,
    label: `Yearly (${key})`,
  };
}

/**
 * Formats a scheduled release date for global users with primary UTC and secondary IST times.
 * e.g. "2026-08-17 00:30 UTC (6:00 AM IST)"
 */
export function formatReleaseUtcWithIst(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "Live Now";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "Live Now";

  const isoDate = d.toISOString().slice(0, 10);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");

  return `${isoDate} ${hours}:${minutes} UTC (6:00 AM IST)`;
}
