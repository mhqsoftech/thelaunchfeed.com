"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  getDailyQuotaStatus,
  syncDeployUrls,
  submitUrl,
  submitBatch,
  DAILY_GOOGLE_QUOTA,
} from "@/lib/indexing";

export interface IndexingLogEntry {
  id: string;
  url: string;
  engine: string;
  type: string;
  status: string;
  httpStatus: number | null;
  errorMessage: string | null;
  responseBody: string | null;
  submittedAt: string;
}

export interface IndexingOverviewData {
  quota: {
    usedToday: number;
    limit: number;
    remaining: number;
    resetAt: string;
  };
  authStatus: {
    hasGoogleCredentials: boolean;
    hasWebIndexingApiKey: boolean;
    hasIndexNowKey: boolean;
    googleAuthMode: "SERVICE_ACCOUNT" | "API_KEY" | "NONE";
  };
  stats: {
    totalSubmissions: number;
    successSubmissions: number;
    failedSubmissions: number;
    quotaSkippedSubmissions: number;
  };
  recentLogs: IndexingLogEntry[];
}

/**
 * Loads indexing overview, daily quota status, and recent audit logs
 */
export async function getIndexingOverviewAction(): Promise<IndexingOverviewData> {
  await requireAdmin();

  const quota = await getDailyQuotaStatus();

  const hasApiKey = Boolean(process.env.WEB_INDEXING_API_KEY?.trim());
  const hasIndexNow = Boolean(process.env.WEB_INDEXING_API_KEY?.trim() || process.env.INDEXNOW_KEY?.trim());

  let totalSubmissions = 0;
  let successSubmissions = 0;
  let failedSubmissions = 0;
  let quotaSkippedSubmissions = 0;
  let logs: any[] = [];

  try {
    if (prisma?.webIndexingLog) {
      const [tSub, sSub, fSub, qSub, logList] = await Promise.all([
        prisma.webIndexingLog.count().catch(() => 0),
        prisma.webIndexingLog.count({ where: { status: "SUCCESS" } }).catch(() => 0),
        prisma.webIndexingLog.count({ where: { status: "FAILED" } }).catch(() => 0),
        prisma.webIndexingLog.count({ where: { status: "SKIPPED_QUOTA" } }).catch(() => 0),
        prisma.webIndexingLog
          .findMany({
            orderBy: { submittedAt: "desc" },
            take: 50,
          })
          .catch(() => []),
      ]);

      totalSubmissions = tSub;
      successSubmissions = sSub;
      failedSubmissions = fSub;
      quotaSkippedSubmissions = qSub;
      logs = logList;
    }
  } catch (err) {
    console.warn("[web-indexing] Could not query WebIndexingLog:", err);
  }

  return {
    quota: {
      usedToday: quota?.usedToday ?? 0,
      limit: quota?.limit ?? DAILY_GOOGLE_QUOTA,
      remaining: quota?.remaining ?? DAILY_GOOGLE_QUOTA,
      resetAt: quota?.resetAt ? quota.resetAt.toISOString() : new Date().toISOString(),
    },
    authStatus: {
      hasGoogleCredentials: hasApiKey,
      hasWebIndexingApiKey: hasApiKey,
      hasIndexNowKey: hasIndexNow,
      googleAuthMode: hasApiKey ? "API_KEY" : "NONE",
    },
    stats: {
      totalSubmissions,
      successSubmissions,
      failedSubmissions,
      quotaSkippedSubmissions,
    },
    recentLogs: (logs || []).map((l) => ({
      id: l.id,
      url: l.url,
      engine: l.engine,
      type: l.type,
      status: l.status,
      httpStatus: l.httpStatus ?? null,
      errorMessage: l.errorMessage ?? null,
      responseBody: l.responseBody ?? null,
      submittedAt: l.submittedAt ? new Date(l.submittedAt).toISOString() : new Date().toISOString(),
    })),
  };
}

/**
 * Triggers deploy sync of latest edited links (max 200)
 */
export async function syncDeployIndexingAction() {
  await requireAdmin();
  const result = await syncDeployUrls(DAILY_GOOGLE_QUOTA);
  revalidatePath("/admin");
  return result;
}

/**
 * Submits a custom single URL or batch of URLs on demand
 */
export async function submitCustomUrlsAction(rawInput: string, engineChoice: "ALL" | "GOOGLE" | "INDEXNOW" = "ALL") {
  await requireAdmin();

  const lines = rawInput
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error("NO_URLS_PROVIDED");
  }

  const engines: ("GOOGLE" | "INDEXNOW")[] =
    engineChoice === "GOOGLE"
      ? ["GOOGLE"]
      : engineChoice === "INDEXNOW"
        ? ["INDEXNOW"]
        : ["GOOGLE", "INDEXNOW"];

  if (lines.length === 1) {
    const res = await submitUrl(lines[0], { type: "URL_UPDATED", engines });
    revalidatePath("/admin");
    return { count: 1, single: res };
  } else {
    const res = await submitBatch(lines, { type: "URL_UPDATED", engines });
    revalidatePath("/admin");
    return { count: lines.length, batch: res };
  }
}

export interface PlatformUrlEntry {
  id: string;
  url: string;
  path: string;
  title: string;
  subtitle?: string;
  type: "PRODUCT" | "FOUNDER" | "CATEGORY" | "STATIC";
  updatedAt: string;
  isSubmitted: boolean;
  submissionCount: number;
  lastStatus: "SUCCESS" | "FAILED" | "SKIPPED_QUOTA" | "NEVER";
  lastSubmittedAt: string | null;
  lastEngine: string | null;
}

export interface PlatformUrlsData {
  urls: PlatformUrlEntry[];
  totalCount: number;
  unsubmittedCount: number;
  submittedCount: number;
  productsCount: number;
  foundersCount: number;
  categoriesCount: number;
  staticCount: number;
}

/**
 * Fetches all platform URLs (Products, Founders, Categories, Static pages)
 * and audits whether each URL has been submitted for web indexing.
 */
export async function getPlatformUrlsAction(): Promise<PlatformUrlsData> {
  await requireAdmin();

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com")
    .replace(/^http:\/\/localhost(:\d+)?/, "https://thelaunchfeed.com")
    .replace(/\/+$/, "");

  // 1. Fetch all submission logs to map submission status by normalized URL
  let logMap = new Map<string, { count: number; lastStatus: "SUCCESS" | "FAILED" | "SKIPPED_QUOTA" | "NEVER"; lastSubmittedAt: string; lastEngine: string }>();

  try {
    if (prisma?.webIndexingLog) {
      const logs = await prisma.webIndexingLog.findMany({
        select: {
          url: true,
          engine: true,
          status: true,
          submittedAt: true,
        },
        orderBy: { submittedAt: "desc" },
      });

      for (const log of logs) {
        const norm = log.url.trim().replace(/^http:\/\/localhost(:\d+)?/, "https://thelaunchfeed.com").replace(/\/+$/, "");
        if (!logMap.has(norm)) {
          logMap.set(norm, {
            count: 1,
            lastStatus: (log.status as any) || "SUCCESS",
            lastSubmittedAt: log.submittedAt.toISOString(),
            lastEngine: log.engine,
          });
        } else {
          logMap.get(norm)!.count++;
        }
      }
    }
  } catch (err) {
    console.warn("[web-indexing] Could not query WebIndexingLog for platform URLs:", err);
  }

  const allEntries: PlatformUrlEntry[] = [];

  // 2. Core Static Pages
  const staticPages = [
    { path: "/", title: "Homepage Leaderboard & Feed", subtitle: "Main live discovery board" },
    { path: "/founders", title: "Founders Leaderboard", subtitle: "Public makers directory" },
    { path: "/submit", title: "Submit a Product", subtitle: "Product launch submission portal" },
    { path: "/about", title: "About The Launch Feed", subtitle: "Mission, story, and ecosystem" },
    { path: "/contact", title: "Contact Support", subtitle: "Inquiries & maker support" },
    { path: "/privacy", title: "Privacy Policy", subtitle: "Data privacy & user security" },
    { path: "/terms", title: "Terms of Service", subtitle: "Platform usage terms" },
  ];

  for (const p of staticPages) {
    const fullUrl = `${appUrl}${p.path}`;
    const logInfo = logMap.get(fullUrl);
    allEntries.push({
      id: `static-${p.path}`,
      url: fullUrl,
      path: p.path,
      title: p.title,
      subtitle: p.subtitle,
      type: "STATIC",
      updatedAt: new Date().toISOString(),
      isSubmitted: Boolean(logInfo),
      submissionCount: logInfo?.count ?? 0,
      lastStatus: logInfo?.lastStatus ?? "NEVER",
      lastSubmittedAt: logInfo?.lastSubmittedAt ?? null,
      lastEngine: logInfo?.lastEngine ?? null,
    });
  }

  // 3. Categories
  try {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, slug: true, createdAt: true },
      orderBy: { name: "asc" },
    });

    for (const c of categories) {
      const path = `/category/${encodeURIComponent(c.slug)}`;
      const fullUrl = `${appUrl}${path}`;
      const logInfo = logMap.get(fullUrl);
      allEntries.push({
        id: `category-${c.id}`,
        url: fullUrl,
        path,
        title: `${c.name} Category`,
        subtitle: `Category archive feed (/category/${c.slug})`,
        type: "CATEGORY",
        updatedAt: (c.createdAt || new Date()).toISOString(),
        isSubmitted: Boolean(logInfo),
        submissionCount: logInfo?.count ?? 0,
        lastStatus: logInfo?.lastStatus ?? "NEVER",
        lastSubmittedAt: logInfo?.lastSubmittedAt ?? null,
        lastEngine: logInfo?.lastEngine ?? null,
      });
    }
  } catch (err) {
    console.warn("[web-indexing] Could not load categories:", err);
  }

  // 4. Products (LIVE)
  try {
    const products = await prisma.product.findMany({
      where: { status: "LIVE" },
      select: { id: true, name: true, slug: true, tagline: true, updatedAt: true, launchedAt: true },
      orderBy: [{ updatedAt: "desc" }, { launchedAt: "desc" }],
    });

    for (const p of products) {
      const path = `/product/${encodeURIComponent(p.slug)}`;
      const fullUrl = `${appUrl}${path}`;
      const logInfo = logMap.get(fullUrl);
      allEntries.push({
        id: `product-${p.id}`,
        url: fullUrl,
        path,
        title: p.name,
        subtitle: p.tagline || `Product launch page (/product/${p.slug})`,
        type: "PRODUCT",
        updatedAt: (p.updatedAt || p.launchedAt || new Date()).toISOString(),
        isSubmitted: Boolean(logInfo),
        submissionCount: logInfo?.count ?? 0,
        lastStatus: logInfo?.lastStatus ?? "NEVER",
        lastSubmittedAt: logInfo?.lastSubmittedAt ?? null,
        lastEngine: logInfo?.lastEngine ?? null,
      });
    }
  } catch (err) {
    console.warn("[web-indexing] Could not load products:", err);
  }

  // 5. Founders (Public profiles)
  try {
    const founders = await prisma.user.findMany({
      where: { isProfilePublic: true, username: { not: "" } },
      select: { id: true, name: true, username: true, title: true, bio: true, updatedAt: true, createdAt: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    for (const u of founders) {
      const cleanUsername = u.username.replace(/^@/, "").trim();
      const path = `/founder/${encodeURIComponent(cleanUsername)}`;
      const fullUrl = `${appUrl}${path}`;
      const logInfo = logMap.get(fullUrl);
      allEntries.push({
        id: `founder-${u.id}`,
        url: fullUrl,
        path,
        title: u.name || `@${cleanUsername}`,
        subtitle: u.title || u.bio || `Founder profile (/founder/${cleanUsername})`,
        type: "FOUNDER",
        updatedAt: (u.updatedAt || u.createdAt || new Date()).toISOString(),
        isSubmitted: Boolean(logInfo),
        submissionCount: logInfo?.count ?? 0,
        lastStatus: logInfo?.lastStatus ?? "NEVER",
        lastSubmittedAt: logInfo?.lastSubmittedAt ?? null,
        lastEngine: logInfo?.lastEngine ?? null,
      });
    }
  } catch (err) {
    console.warn("[web-indexing] Could not load founders:", err);
  }

  const unsubmittedCount = allEntries.filter((e) => !e.isSubmitted).length;
  const submittedCount = allEntries.filter((e) => e.isSubmitted).length;
  const productsCount = allEntries.filter((e) => e.type === "PRODUCT").length;
  const foundersCount = allEntries.filter((e) => e.type === "FOUNDER").length;
  const categoriesCount = allEntries.filter((e) => e.type === "CATEGORY").length;
  const staticCount = allEntries.filter((e) => e.type === "STATIC").length;

  return {
    urls: allEntries,
    totalCount: allEntries.length,
    unsubmittedCount,
    submittedCount,
    productsCount,
    foundersCount,
    categoriesCount,
    staticCount,
  };
}

/**
 * Submits an explicit list of selected URLs
 */
export async function submitSelectedUrlsAction(urls: string[], engineChoice: "ALL" | "GOOGLE" | "INDEXNOW" = "ALL") {
  await requireAdmin();

  if (!urls || urls.length === 0) {
    throw new Error("NO_URLS_SELECTED");
  }

  const engines: ("GOOGLE" | "INDEXNOW")[] =
    engineChoice === "GOOGLE"
      ? ["GOOGLE"]
      : engineChoice === "INDEXNOW"
        ? ["INDEXNOW"]
        : ["GOOGLE", "INDEXNOW"];

  if (urls.length === 1) {
    const res = await submitUrl(urls[0], { type: "URL_UPDATED", engines });
    revalidatePath("/admin");
    return { count: 1, single: res };
  } else {
    const res = await submitBatch(urls, { type: "URL_UPDATED", engines });
    revalidatePath("/admin");
    return { count: urls.length, batch: res };
  }
}

/**
 * Submits all unsubmitted URLs on the platform up to the given engine's capacity
 */
export async function submitAllUnsubmittedUrlsAction(engineChoice: "ALL" | "GOOGLE" | "INDEXNOW" = "ALL") {
  await requireAdmin();

  const overview = await getPlatformUrlsAction();
  const unsubmittedUrls = overview.urls.filter((u) => !u.isSubmitted).map((u) => u.url);

  if (unsubmittedUrls.length === 0) {
    return { count: 0, message: "All existing platform URLs are already submitted for indexing." };
  }

  return await submitSelectedUrlsAction(unsubmittedUrls, engineChoice);
}
