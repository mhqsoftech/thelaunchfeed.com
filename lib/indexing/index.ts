/**
 * Web Search Indexing Engine for The Launch Feed
 *
 * Coordinates Google Web Search Indexing API (v3) and IndexNow protocol submissions.
 * Enforces Google's strict 200 requests/day quota and tracks all submissions in WebIndexingLog.
 */

import { prisma } from "@/lib/db";
import { publishGoogleUrlNotification, IndexingNotificationType, GoogleIndexingResult } from "./google";
import { submitToIndexNow, IndexNowResult } from "./indexnow";

export const DAILY_GOOGLE_QUOTA = 200;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com")
  .replace(/^http:\/\/localhost(:\d+)?/, "https://thelaunchfeed.com")
  .replace(/\/+$/, "");

export interface DailyQuotaStatus {
  usedToday: number;
  limit: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Calculates current UTC day boundaries and gets Google Indexing quota used today
 */
export async function getDailyQuotaStatus(): Promise<DailyQuotaStatus> {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

  let usedToday = 0;
  try {
    if (prisma?.webIndexingLog?.count) {
      usedToday = await prisma.webIndexingLog.count({
        where: {
          engine: "GOOGLE",
          submittedAt: { gte: startOfDay },
          status: { in: ["SUCCESS", "FAILED"] },
        },
      });
    }
  } catch (err) {
    console.warn("[web-indexing] Failed to query daily quota:", err);
  }

  const remaining = Math.max(0, DAILY_GOOGLE_QUOTA - usedToday);

  return {
    usedToday,
    limit: DAILY_GOOGLE_QUOTA,
    remaining,
    resetAt: endOfDay,
  };
}

/**
 * Normalizes a URL to full absolute production URL
 */
export function normalizeUrl(pathOrUrl: string): string {
  let trimmed = pathOrUrl.trim();
  if (trimmed.startsWith("http://localhost")) {
    trimmed = trimmed.replace(/^http:\/\/localhost(:\d+)?/, "https://thelaunchfeed.com");
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${APP_URL}${cleanPath}`;
}

export interface SubmitUrlOptions {
  type?: IndexingNotificationType;
  engines?: ("GOOGLE" | "INDEXNOW")[];
}

export interface SubmissionResultSummary {
  url: string;
  google?: GoogleIndexingResult | { skipped: boolean; reason: string };
  indexnow?: IndexNowResult;
}

/**
 * Submits a single URL to Google Web Indexing API and IndexNow
 */
export async function submitUrl(
  rawUrl: string,
  options: SubmitUrlOptions = {}
): Promise<SubmissionResultSummary> {
  const url = normalizeUrl(rawUrl);
  const type = options.type || "URL_UPDATED";
  const engines = options.engines || ["GOOGLE", "INDEXNOW"];

  const summary: SubmissionResultSummary = { url };

  // 1. Google Web Indexing API (Strict 200/day quota)
  if (engines.includes("GOOGLE")) {
    const quota = await getDailyQuotaStatus();

    if (quota.remaining <= 0) {
      // Quota exhausted for today
      try {
        if (prisma?.webIndexingLog?.create) {
          await prisma.webIndexingLog.create({
            data: {
              url,
              engine: "GOOGLE",
              type,
              status: "SKIPPED_QUOTA",
              errorMessage: `Daily quota of ${DAILY_GOOGLE_QUOTA} URLs reached for today. Will sync on next cycle.`,
            },
          });
        }
      } catch (logErr) {
        console.warn("[web-indexing] Log create warning:", logErr);
      }

      summary.google = {
        skipped: true,
        reason: `Daily quota of ${DAILY_GOOGLE_QUOTA} URLs reached.`,
      };
    } else {
      const gResult = await publishGoogleUrlNotification(url, type);
      summary.google = gResult;

      try {
        if (prisma?.webIndexingLog?.create) {
          await prisma.webIndexingLog.create({
            data: {
              url,
              engine: "GOOGLE",
              type,
              status: gResult.success ? "SUCCESS" : "FAILED",
              httpStatus: gResult.httpStatus,
              responseBody: gResult.responseBody ? JSON.stringify(gResult.responseBody).slice(0, 4000) : null,
              errorMessage: gResult.errorMessage || null,
            },
          });
        }
      } catch (logErr) {
        console.warn("[web-indexing] Log create warning:", logErr);
      }
    }
  }

  // 2. IndexNow Protocol (Bing, Yandex, etc.)
  if (engines.includes("INDEXNOW")) {
    const inResult = await submitToIndexNow(url);
    summary.indexnow = inResult;

    try {
      if (prisma?.webIndexingLog?.create) {
        await prisma.webIndexingLog.create({
          data: {
            url,
            engine: "INDEXNOW",
            type,
            status: inResult.success ? "SUCCESS" : "FAILED",
            httpStatus: inResult.httpStatus,
            responseBody: inResult.responseBody ? JSON.stringify(inResult.responseBody).slice(0, 4000) : null,
            errorMessage: inResult.errorMessage || null,
          },
        });
      }
    } catch (logErr) {
      console.warn("[web-indexing] Log create warning:", logErr);
    }
  }

  return summary;
}

/**
 * Submits a batch of URLs with rate limiting and quota enforcement (Max 200 latest for Google)
 */
export async function submitBatch(
  rawUrls: string[],
  options: SubmitUrlOptions = {}
): Promise<{
  total: number;
  googleSubmitted: number;
  googleSkippedQuota: number;
  googleFailed: number;
  indexNowSubmitted: number;
  results: SubmissionResultSummary[];
}> {
  const uniqueUrls = Array.from(new Set(rawUrls.map(normalizeUrl)));
  const results: SubmissionResultSummary[] = [];

  let googleSubmitted = 0;
  let googleSkippedQuota = 0;
  let googleFailed = 0;
  let indexNowSubmitted = 0;

  const quota = await getDailyQuotaStatus();
  let availableGoogleQuota = quota.remaining;

  const logsToPersist: Array<{
    url: string;
    engine: string;
    type: string;
    status: string;
    httpStatus?: number | null;
    responseBody?: string | null;
    errorMessage?: string | null;
  }> = [];

  // Submit to IndexNow in bulk first (IndexNow supports multi-URL batch)
  if (!options.engines || options.engines.includes("INDEXNOW")) {
    const inBatchResult = await submitToIndexNow(uniqueUrls);
    if (inBatchResult.success) {
      indexNowSubmitted = uniqueUrls.length;
    }
    for (const u of uniqueUrls) {
      logsToPersist.push({
        url: u,
        engine: "INDEXNOW",
        type: options.type || "URL_UPDATED",
        status: inBatchResult.success ? "SUCCESS" : "FAILED",
        httpStatus: inBatchResult.httpStatus,
        responseBody: inBatchResult.responseBody ? JSON.stringify(inBatchResult.responseBody).slice(0, 4000) : null,
        errorMessage: inBatchResult.errorMessage || null,
      });
    }
  }

  // Submit to Google Indexing API in paced sequential / mini-batch manner
  for (const url of uniqueUrls) {
    if (options.engines && !options.engines.includes("GOOGLE")) {
      continue;
    }

    if (availableGoogleQuota <= 0) {
      googleSkippedQuota++;
      logsToPersist.push({
        url,
        engine: "GOOGLE",
        type: options.type || "URL_UPDATED",
        status: "SKIPPED_QUOTA",
        errorMessage: `Daily quota of ${DAILY_GOOGLE_QUOTA} reached.`,
      });
      results.push({
        url,
        google: { skipped: true, reason: `Daily limit of ${DAILY_GOOGLE_QUOTA} reached.` },
      });
      continue;
    }

    availableGoogleQuota--;
    const gResult = await publishGoogleUrlNotification(url, options.type || "URL_UPDATED");
    if (gResult.success) {
      googleSubmitted++;
    } else {
      googleFailed++;
    }

    logsToPersist.push({
      url,
      engine: "GOOGLE",
      type: options.type || "URL_UPDATED",
      status: gResult.success ? "SUCCESS" : "FAILED",
      httpStatus: gResult.httpStatus,
      responseBody: gResult.responseBody ? JSON.stringify(gResult.responseBody).slice(0, 4000) : null,
      errorMessage: gResult.errorMessage || null,
    });

    results.push({ url, google: gResult });
  }

  // Persist all accumulated logs in a single batch insert
  if (logsToPersist.length > 0 && prisma?.webIndexingLog?.createMany) {
    try {
      await prisma.webIndexingLog.createMany({
        data: logsToPersist,
      });
    } catch (dbErr) {
      console.warn("[web-indexing] Bulk log insert warning:", dbErr);
    }
  }

  return {
    total: uniqueUrls.length,
    googleSubmitted,
    googleSkippedQuota,
    googleFailed,
    indexNowSubmitted,
    results,
  };
}

/* ───────────────────────── automatic sync: settings, planning, runs ─────────────────────────
 *
 * Automatic sources (the 6-hourly cron, POST /api/indexing/sync with a token,
 * and the on-launch trigger) go through runIndexingSync / isIndexingPaused:
 *   • a Pause switch stops all of them (manual admin buttons still work);
 *   • only due URLs are sent: never successfully submitted to that engine,
 *     or (optionally) last sent more than `resubmitDays` ago. Product
 *     `updatedAt` can't mean "content changed" here: votes and the 5-minute
 *     rank sync touch it constantly, which is why the old "latest updated"
 *     list re-sent the same pages every day;
 *   • Google gets at most the remaining daily quota, and URLs over it simply
 *     wait for the next run instead of being logged as SKIPPED_QUOTA.
 * Settings live in AppSetting["web_indexing_config"], so no schema change.
 */

const CONFIG_KEY = "web_indexing_config";
const INDEXNOW_MAX_PER_RUN = 500;

export type IndexingEngine = "GOOGLE" | "INDEXNOW";

export interface IndexingRunSummary {
  at: string;
  source: "schedule" | "endpoint" | "manual";
  paused: boolean;
  due: { google: number; indexNow: number };
  googleSubmitted: number;
  googleFailed: number;
  /** Due for Google but over today's quota: left for the next run. */
  googleDeferred: number;
  indexNowSubmitted: number;
}

export interface IndexingConfig {
  paused: boolean;
  /** Re-send a page this many days after its last successful submission; 0 = never. */
  resubmitDays: number;
  lastRun: IndexingRunSummary | null;
}

const DEFAULT_CONFIG: IndexingConfig = { paused: false, resubmitDays: 0, lastRun: null };

export async function getIndexingConfig(): Promise<IndexingConfig> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY } });
    const v = (row?.value ?? {}) as Partial<IndexingConfig>;
    return {
      paused: v.paused === true,
      resubmitDays: Number.isFinite(v.resubmitDays) ? Math.max(0, Math.floor(v.resubmitDays as number)) : 0,
      lastRun: (v.lastRun as IndexingRunSummary) ?? null,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function updateIndexingConfig(patch: Partial<IndexingConfig>): Promise<IndexingConfig> {
  const next = { ...(await getIndexingConfig()), ...patch };
  await prisma.appSetting.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: next as object },
    update: { value: next as object },
  });
  return next;
}

export async function isIndexingPaused(): Promise<boolean> {
  return (await getIndexingConfig()).paused;
}

const urlKey = (u: string) => normalizeUrl(u).replace(/\/+$/, "").toLowerCase();

/**
 * Every public page worth indexing: core pages, boards, categories, live
 * products, and founders who have at least one live product (empty profiles
 * are thin pages). Newest products first.
 */
export async function collectPlatformUrls(): Promise<string[]> {
  const staticPaths = [
    "/",
    "/leaderboard/weekly",
    "/leaderboard/monthly",
    "/leaderboard/yearly",
    "/leaderboard/all-time",
    "/categories",
    "/founders",
    "/badges",
    "/submit",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
  ];
  const [categories, products, founders] = await Promise.all([
    prisma.category.findMany({ select: { slug: true }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { status: "LIVE" }, select: { slug: true }, orderBy: { launchedAt: "desc" } }),
    prisma.user.findMany({
      where: { isProfilePublic: true, username: { not: "" }, products: { some: { status: "LIVE" } } },
      select: { username: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const urls = [
    ...staticPaths.map((p) => `${APP_URL}${p}`),
    ...products.map((p) => `${APP_URL}/product/${encodeURIComponent(p.slug)}`),
    ...categories.map((c) => `${APP_URL}/category/${encodeURIComponent(c.slug)}`),
    ...founders.map((u) => `${APP_URL}/founder/${encodeURIComponent(u.username.replace(/^@/, "").trim())}`),
  ];
  return Array.from(new Set(urls));
}

/**
 * URLs due for one engine, in submission order: never successfully sent
 * first (in collection order), then the longest-ago re-sends.
 */
export async function planDueUrls(
  engine: IndexingEngine,
  candidates: string[],
  resubmitDays: number,
  now = new Date()
): Promise<string[]> {
  const sent = await prisma.webIndexingLog.groupBy({
    by: ["url"],
    where: { engine, status: "SUCCESS" },
    _max: { submittedAt: true },
  });
  const lastSent = new Map<string, number>();
  for (const s of sent) {
    const t = s._max.submittedAt?.getTime() ?? 0;
    const k = urlKey(s.url);
    if (t > (lastSent.get(k) ?? 0)) lastSent.set(k, t);
  }
  const cutoff = resubmitDays > 0 ? now.getTime() - resubmitDays * 86_400_000 : -Infinity;
  const fresh: string[] = [];
  const stale: Array<{ url: string; at: number }> = [];
  for (const url of candidates) {
    const at = lastSent.get(urlKey(url));
    if (at === undefined) fresh.push(url);
    else if (at < cutoff) stale.push({ url, at });
  }
  stale.sort((a, b) => a.at - b.at);
  return [...fresh, ...stale.map((s) => s.url)];
}

/** How many URLs each engine would get on the next run. */
export async function countDueUrls() {
  const config = await getIndexingConfig();
  const candidates = await collectPlatformUrls();
  const [google, indexNow] = await Promise.all([
    planDueUrls("GOOGLE", candidates, config.resubmitDays),
    planDueUrls("INDEXNOW", candidates, config.resubmitDays),
  ]);
  return { total: candidates.length, google: google.length, indexNow: indexNow.length };
}

/**
 * One sync pass. Automatic sources pass respectPause; the admin's own
 * "Sync now" button does not (it is an explicit request), but it still only
 * sends due URLs.
 */
export async function runIndexingSync({
  source,
  respectPause,
}: {
  source: IndexingRunSummary["source"];
  respectPause: boolean;
}): Promise<IndexingRunSummary> {
  const config = await getIndexingConfig();
  const at = new Date().toISOString();
  if (respectPause && config.paused) {
    return {
      at,
      source,
      paused: true,
      due: { google: 0, indexNow: 0 },
      googleSubmitted: 0,
      googleFailed: 0,
      googleDeferred: 0,
      indexNowSubmitted: 0,
    };
  }

  const candidates = await collectPlatformUrls();
  const [googleDue, indexNowDue] = await Promise.all([
    planDueUrls("GOOGLE", candidates, config.resubmitDays),
    planDueUrls("INDEXNOW", candidates, config.resubmitDays),
  ]);
  const quota = await getDailyQuotaStatus();
  const googleNow = googleDue.slice(0, quota.remaining);
  const indexNowNow = indexNowDue.slice(0, INDEXNOW_MAX_PER_RUN);

  const g = googleNow.length ? await submitBatch(googleNow, { type: "URL_UPDATED", engines: ["GOOGLE"] }) : null;
  const n = indexNowNow.length ? await submitBatch(indexNowNow, { type: "URL_UPDATED", engines: ["INDEXNOW"] }) : null;

  const summary: IndexingRunSummary = {
    at,
    source,
    paused: false,
    due: { google: googleDue.length, indexNow: indexNowDue.length },
    googleSubmitted: g?.googleSubmitted ?? 0,
    googleFailed: g?.googleFailed ?? 0,
    googleDeferred: Math.max(0, googleDue.length - googleNow.length),
    indexNowSubmitted: n?.indexNowSubmitted ?? 0,
  };
  // Re-read so a Pause clicked during the run isn't overwritten.
  await updateIndexingConfig({ lastRun: summary }).catch((e) => console.warn("[web-indexing] lastRun save failed:", e));
  return summary;
}
