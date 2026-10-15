/**
 * Free-launch requirements.
 *
 * A $0 launch is free in money, not in effort. Before it can go live the
 * maker must:
 *   1. show our badge on their website (a link back to thelaunchfeed.com), and
 *   2. upvote REQUIRED_UPVOTES other launched products since their last free
 *      launch (so each free launch gives something back to the community).
 *
 * The badge is verified two ways so client-rendered (SPA) sites work too:
 *   - "html":    we fetch the page and find an <a href> / <img src> pointing at us
 *   - "referer": the badge image was requested with a Referer from their domain
 *
 * Paid launches ($5 / $10, details.isPaidPlacement) skip both requirements.
 * Free launches whose badge later disappears lose their dofollow link
 * (product.details.backlinkRel = "nofollow") via the nightly audit job.
 */

import { prisma } from "@/lib/db";
import { safeFetch } from "@/lib/ssrf";
import { ensureJobTables } from "@/lib/jobs/schema";

export const REQUIRED_UPVOTES = 3;
/** Submissions created from this version on are subject to the gate. */
export const FREE_GATE_VERSION = 1;
const REFERER_FRESH_MS = 30 * 24 * 60 * 60 * 1000;

const SITE = () => (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

/**
 * Stable key for a maker's site, known before the product has a slug:
 * "https://www.Acme.com/app/" → "acme.com/app". Hostname (no www) + path,
 * so products on shared hosts (github.com/user/repo) stay distinct.
 */
export function siteKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || !host.includes(".")) return null;
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return null;
  }
}

/**
 * The live product for a site key, if it has launched. Exact host+path match
 * first; a bare host also matches when exactly one live product uses it.
 */
export async function findLiveProductBySite(key: string): Promise<{ id: string; slug: string } | null> {
  const k = siteKey(key);
  if (!k) return null;
  const host = k.split("/")[0];
  const candidates = await prisma.product.findMany({
    where: { status: "LIVE", websiteUrl: { contains: host, mode: "insensitive" } },
    orderBy: { launchedAt: "desc" },
    select: { id: true, slug: true, websiteUrl: true },
    take: 50,
  });
  const exact = candidates.find((c) => siteKey(c.websiteUrl) === k);
  if (exact) return { id: exact.id, slug: exact.slug };

  // The maker changed their website URL after embedding the badge: every key
  // a submission/product has ever had is kept in details.badgeKeys.
  const historic = await prisma.product.findFirst({
    where: { status: "LIVE", details: { path: ["badgeKeys"], array_contains: [k] } },
    orderBy: { launchedAt: "desc" },
    select: { id: true, slug: true },
  });
  if (historic) return historic;

  if (!k.includes("/")) {
    const sameHost = candidates.filter((c) => siteKey(c.websiteUrl)?.split("/")[0] === host);
    if (sameHost.length === 1) return { id: sameHost[0].id, slug: sameHost[0].slug };
  }
  return null;
}

/** Append the site key(s) for these URLs to a details.badgeKeys history. */
export function withBadgeKeys(previous: unknown, ...urls: Array<string | null | undefined>): string[] {
  const keys = Array.isArray(previous) ? previous.filter((x): x is string => typeof x === "string") : [];
  for (const u of urls) {
    const k = siteKey(u);
    if (k && !keys.includes(k)) keys.push(k);
  }
  return keys.slice(-10);
}

/** Smart link for a maker's site: → their product page once live, else our homepage. */
export function smartLaunchUrl(websiteUrl?: string | null) {
  const k = siteKey(websiteUrl);
  return k ? `${SITE()}/launch/${k}` : `${SITE()}/?ref=badge`;
}

export function badgeSnippet(theme: "light" | "dark" = "light", websiteUrl?: string | null) {
  const site = SITE();
  const k = siteKey(websiteUrl);
  const img = `${site}/api/badge/featured?theme=${theme}${k ? `&site=${encodeURIComponent(k)}` : ""}`;
  return `<a href="${smartLaunchUrl(websiteUrl)}" target="_blank" title="Featured on The Launch Feed"><img src="${img}" alt="Featured on The Launch Feed" width="220" height="48" /></a>`;
}

/** "https://www.Foo.com/bar" → "foo.com" */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    return url.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Domains that count as "our badge/link" in fetched HTML. */
function ourHosts() {
  const hosts = new Set(["thelaunchfeed.com"]);
  const own = normalizeDomain(SITE());
  if (own) hosts.add(own);
  return [...hosts];
}

/** Does this HTML contain a link to us or our badge image? */
export function htmlHasBadge(html: string): boolean {
  const hosts = ourHosts().map((h) => h.replace(/\./g, "\\."));
  const re = new RegExp(`(?:href|src)\\s*=\\s*["'][^"']*(?:${hosts.join("|")})[^"']*["']`, "i");
  return re.test(html);
}

export type BadgeCheck = {
  domain: string | null;
  verified: boolean;
  method: "html" | "referer" | null;
  reason?: string;
};

async function saveCheck(domain: string, verified: boolean, method: "html" | "referer" | null, error?: string) {
  const now = new Date();
  await prisma.badgeVerification.upsert({
    where: { domain },
    create: {
      domain,
      status: verified ? "VERIFIED" : "MISSING",
      method,
      verifiedAt: verified ? now : null,
      lastSeenAt: verified ? now : null,
      lastCheckedAt: now,
      lastError: error ?? null,
    },
    update: {
      status: verified ? "VERIFIED" : "MISSING",
      ...(verified ? { method, verifiedAt: now, lastSeenAt: now } : {}),
      lastCheckedAt: now,
      lastError: error ?? null,
    },
  });
}

/**
 * Live check: fetch the maker's site and look for the badge, falling back to a
 * recent badge-image impression from that domain.
 */
export async function verifyBadge(websiteUrl: string): Promise<BadgeCheck> {
  await ensureJobTables();
  const domain = normalizeDomain(websiteUrl);
  if (!domain) return { domain: null, verified: false, method: null, reason: "Enter a valid website URL first." };

  let fetchError: string | undefined;
  try {
    const target = /^https?:\/\//i.test(websiteUrl.trim()) ? websiteUrl.trim() : `https://${websiteUrl.trim()}`;
    const res = await safeFetch(target, {
      timeoutMs: 10_000,
      headers: {
        "User-Agent": "TheLaunchFeedBadgeCheck/1.0 (+https://thelaunchfeed.com/badges)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (res.ok) {
      const html = (await res.text()).slice(0, 2_000_000);
      if (htmlHasBadge(html)) {
        await saveCheck(domain, true, "html");
        return { domain, verified: true, method: "html" };
      }
    } else {
      fetchError = `Your site responded with HTTP ${res.status}.`;
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message.replace(/^ssrf: /, "") : String(err);
  }

  // Client-rendered sites: accept a recent badge impression from the domain.
  const row = await prisma.badgeVerification.findUnique({ where: { domain } });
  if (row?.lastSeenAt && row.method === "referer" && Date.now() - row.lastSeenAt.getTime() < REFERER_FRESH_MS) {
    await prisma.badgeVerification.update({
      where: { domain },
      data: { status: "VERIFIED", lastCheckedAt: new Date(), lastError: null },
    });
    return { domain, verified: true, method: "referer" };
  }

  const reason =
    fetchError ??
    `We couldn't find a link to thelaunchfeed.com on ${domain}. Paste the badge snippet into your homepage, deploy, then verify again.`;
  await saveCheck(domain, false, null, reason);
  return { domain, verified: false, method: null, reason };
}

/** Called by the badge image route: a load from a maker's site proves the embed. */
export async function recordBadgeImpression(referer: string | null) {
  const domain = normalizeDomain(referer);
  if (!domain || ourHosts().includes(domain) || domain === "localhost") return;
  try {
    await ensureJobTables();
    const now = new Date();
    await prisma.badgeVerification.upsert({
      where: { domain },
      create: { domain, status: "VERIFIED", method: "referer", verifiedAt: now, lastSeenAt: now, lastCheckedAt: now },
      update: { status: "VERIFIED", method: "referer", lastSeenAt: now, verifiedAt: now },
    });
  } catch (err) {
    console.warn("[badge] impression not recorded:", err);
  }
}

/** Stored (no network) badge status for a domain — used at publish time. */
export async function storedBadgeVerified(websiteUrl: string): Promise<boolean> {
  const domain = normalizeDomain(websiteUrl);
  if (!domain) return false;
  await ensureJobTables();
  const row = await prisma.badgeVerification.findUnique({ where: { domain } });
  return row?.status === "VERIFIED";
}

/* ─────────── upvote requirement ─────────── */

/**
 * Upvotes count when cast on someone else's LIVE, real (non-seed) product after the maker's
 * previous free launch qualified — each free launch needs fresh upvotes.
 */
export async function upvoteProgress(userId: string, opts: { excludeSubmissionId?: string } = {}) {
  const previous = await prisma.submission.findMany({
    where: {
      ownerId: userId,
      ...(opts.excludeSubmissionId ? { id: { not: opts.excludeSubmissionId } } : {}),
      details: { path: ["freeLaunch", "qualified"], equals: true },
    },
    select: { details: true },
  });
  const since = previous
    .map((s) => Date.parse(((s.details as any)?.freeLaunch?.qualifiedAt as string) || ""))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)[0];

  const votes = await prisma.vote.findMany({
    where: {
      userId,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      product: { status: "LIVE", ownerId: { not: userId }, owner: { isSeed: false } },
    },
    select: { productId: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    required: REQUIRED_UPVOTES,
    done: Math.min(votes.length, REQUIRED_UPVOTES),
    votedProductIds: votes.map((v) => v.productId),
    since: since ? new Date(since).toISOString() : null,
  };
}

/* ─────────── combined gate ─────────── */

export type FreeLaunchGate = {
  qualified: boolean;
  upvotes: { required: number; done: number };
  badge: { domain: string | null; verified: boolean };
  message?: string;
};

export async function evaluateFreeGate(
  userId: string,
  websiteUrl: string,
  opts: { liveBadgeCheck?: boolean; excludeSubmissionId?: string } = {}
): Promise<FreeLaunchGate & { votedProductIds: string[] }> {
  const [votes, badge] = await Promise.all([
    upvoteProgress(userId, { excludeSubmissionId: opts.excludeSubmissionId }),
    opts.liveBadgeCheck
      ? verifyBadge(websiteUrl).then((b) => ({ domain: b.domain, verified: b.verified, reason: b.reason }))
      : storedBadgeVerified(websiteUrl).then((v) => ({ domain: normalizeDomain(websiteUrl), verified: v, reason: undefined as string | undefined })),
  ]);
  const upvotesOk = votes.done >= REQUIRED_UPVOTES;
  const missing: string[] = [];
  if (!badge.verified) missing.push("embed The Launch Feed badge on your website");
  if (!upvotesOk) missing.push(`upvote ${REQUIRED_UPVOTES - votes.done} more launched product${REQUIRED_UPVOTES - votes.done === 1 ? "" : "s"}`);
  return {
    qualified: badge.verified && upvotesOk,
    upvotes: { required: REQUIRED_UPVOTES, done: votes.done },
    badge: { domain: badge.domain, verified: badge.verified },
    votedProductIds: votes.votedProductIds,
    message: missing.length ? `To launch for free, ${missing.join(" and ")} — or pick a paid launch.` : undefined,
  };
}

/** Details stamp written onto a submission that passed the gate. */
export function freeLaunchStamp(gate: { badge: { domain: string | null }; votedProductIds: string[] }) {
  return {
    qualified: true,
    qualifiedAt: new Date().toISOString(),
    badgeDomain: gate.badge.domain,
    upvotedProductIds: gate.votedProductIds.slice(0, REQUIRED_UPVOTES),
  };
}

export function isPaidLaunch(details: unknown): boolean {
  return Boolean((details as Record<string, unknown> | null)?.isPaidPlacement);
}

export function requestedTier(details: unknown): 0 | 5 | 10 {
  const t = Number((details as Record<string, unknown> | null)?.launchTier);
  return t === 5 || t === 10 ? t : 0;
}

/** Keys only the server may write — never trusted from client-sent details. */
const PROTECTED_DETAIL_KEYS = ["isPaidPlacement", "purchaseId", "freeLaunch", "freeGateVersion", "backlinkRel", "publishHold", "badgeKeys"];

/** Secrets must never be persisted in `details` (it is rendered publicly). */
export const SECRET_DETAIL_KEYS = ["apiKey", "apiSecret", "secretKey", "revenueApiKey", "stripeApiKey"];

export function dropSecrets<T extends Record<string, unknown>>(details: T): T {
  for (const k of SECRET_DETAIL_KEYS) delete (details as Record<string, unknown>)[k];
  return details;
}

export function stripProtectedDetails(details: Record<string, unknown> | null | undefined) {
  if (!details) return details ?? undefined;
  const copy = { ...details };
  for (const k of PROTECTED_DETAIL_KEYS) delete copy[k];
  return dropSecrets(copy);
}

export function pickProtectedDetails(details: unknown): Record<string, unknown> {
  const src = (details as Record<string, unknown>) || {};
  const out: Record<string, unknown> = {};
  for (const k of PROTECTED_DETAIL_KEYS) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

/**
 * Gate check used when a submission enters the launch queue. Uses the stored
 * badge status first and only fetches the site when it isn't verified yet.
 */
export async function requireFreeGate(userId: string, websiteUrl: string, excludeSubmissionId?: string) {
  let gate = await evaluateFreeGate(userId, websiteUrl, { excludeSubmissionId });
  if (!gate.badge.verified) gate = await evaluateFreeGate(userId, websiteUrl, { liveBadgeCheck: true, excludeSubmissionId });
  return gate;
}

/** Internal bookkeeping that public pages don't need. */
const INTERNAL_DETAIL_KEYS = ["freeLaunch", "publishHold", "badgeKeys", "purchaseId", "freeGateVersion"];

/** `details` as it may be shown to visitors: no secrets, no internal bookkeeping. */
export function publicDetails(details: unknown): Record<string, unknown> | null {
  if (!details || typeof details !== "object") return null;
  const copy = { ...(details as Record<string, unknown>) };
  for (const k of [...SECRET_DETAIL_KEYS, ...INTERNAL_DETAIL_KEYS]) delete copy[k];
  return copy;
}
