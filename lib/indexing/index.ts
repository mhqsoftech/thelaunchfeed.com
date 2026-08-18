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

/**
 * Collects the latest edited/created URLs across the entire platform up to max limit (default 200)
 */
export async function collectDeployAndRecentUrls(limit = DAILY_GOOGLE_QUOTA): Promise<string[]> {
  const urls: string[] = [];

  // 1. Core static pages
  const staticPaths = ["/", "/founders", "/submit", "/about", "/contact", "/privacy", "/terms"];
  for (const p of staticPaths) {
    urls.push(`${APP_URL}${p}`);
  }

  // 2. Categories
  const categories = await prisma.category.findMany({
    select: { slug: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  for (const c of categories) {
    urls.push(`${APP_URL}/category/${encodeURIComponent(c.slug)}`);
  }

  const remainingSlots = Math.max(10, limit - urls.length);
  const productSlots = Math.floor(remainingSlots * 0.65);
  const founderSlots = remainingSlots - productSlots;

  // 3. Latest modified/launched Products (ordered by updatedAt desc)
  const products = await prisma.product.findMany({
    where: { status: "LIVE" },
    select: { slug: true },
    orderBy: [{ updatedAt: "desc" }, { launchedAt: "desc" }],
    take: productSlots,
  });
  for (const p of products) {
    urls.push(`${APP_URL}/product/${encodeURIComponent(p.slug)}`);
  }

  // 4. Latest modified public Founders (ordered by updatedAt desc)
  const users = await prisma.user.findMany({
    where: { isProfilePublic: true, username: { not: "" } },
    select: { username: true },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: founderSlots,
  });
  for (const u of users) {
    urls.push(`${APP_URL}/founder/${encodeURIComponent(u.username.replace(/^@/, "").trim())}`);
  }

  return Array.from(new Set(urls)).slice(0, limit);
}

/**
 * Runs the production deploy sync: collects latest edited links (max 200) and submits them
 */
export async function syncDeployUrls(limit = DAILY_GOOGLE_QUOTA) {
  const urls = await collectDeployAndRecentUrls(limit);
  return await submitBatch(urls, { type: "URL_UPDATED" });
}
