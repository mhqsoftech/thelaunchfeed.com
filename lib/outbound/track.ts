/**
 * Outbound click tracking — server side of /go/<slug>.
 *
 *  resolveDestination()  slug (+ optional slot id) → the maker's URL, read from
 *                        our DB (never from the query string, so /go is not an
 *                        open redirect). Cached in memory for a minute.
 *  recordClick()         one upsert per click, run from `after()` so the
 *                        redirect never waits on (or fails because of) the DB.
 *
 * Privacy: no raw IPs. A visitor is sha256(secret + UTC day + IP + UA), so the
 * same person is one visitor per product/placement/day and hashes cannot be
 * linked across days. DNT / Sec-GPC, bots and prefetches are never recorded.
 */

import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { formatProductWebsiteUrl } from "@/app/data";
import { ensureOutboundTables } from "@/lib/jobs/schema";
import type { OutboundSource } from "./links";

export type Destination = { productId: string; url: string };

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 2_000;
const destCache = new Map<string, { at: number; value: Destination | null }>();

function toSafeUrl(raw: string | null | undefined): string | null {
  const formatted = formatProductWebsiteUrl(raw);
  if (!formatted) return null;
  try {
    const u = new URL(formatted);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function resolveDestination(slug: string, slotId?: string | null): Promise<Destination | null> {
  const key = `${slug}|${slotId ?? ""}`;
  const hit = destCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, websiteUrl: true },
  });
  let value: Destination | null = null;
  if (product) {
    let url = toSafeUrl(product.websiteUrl);
    if (slotId) {
      // A paid/custom slot may point somewhere other than the product's site
      // (lib/queries/slots.ts → resolveSlotUrl); honour it only for this product.
      const slot = await prisma.featuredSlot.findFirst({
        where: { id: slotId, productId: product.id },
        select: { customUrl: true },
      });
      if (slot?.customUrl && /^https?:\/\//i.test(slot.customUrl.trim())) url = toSafeUrl(slot.customUrl) ?? url;
    }
    if (url) value = { productId: product.id, url };
  }

  if (destCache.size >= CACHE_MAX) destCache.clear();
  destCache.set(key, { at: Date.now(), value });
  return value;
}

/* ─────────── who clicked ─────────── */

const BOT_UA =
  /bot|crawl|spider|slurp|preview|fetch|monitor|scan|curl|wget|python|httpclient|axios|node-fetch|go-http|java\/|headless|lighthouse|pagespeed|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|skype|vkshare|bitly/i;

export type ClickContext = {
  track: boolean;
  visitorHash: string;
  referrerHost: string | null;
  day: string;
};

function clientIp(h: Headers): string {
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0] ||
    ""
  ).trim();
}

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function hashSecret() {
  return process.env.APP_SECRET || process.env.TOKEN_ENCRYPTION_KEY || "tlf-outbound";
}

/** Read everything recordClick needs from the request, up front (request
 *  APIs are not reliable once the response has been sent). */
export function clickContext(req: Request): ClickContext {
  const h = req.headers;
  const ua = h.get("user-agent") || "";
  const purpose = `${h.get("purpose") || ""} ${h.get("sec-purpose") || ""} ${h.get("x-purpose") || ""}`;
  const track =
    req.method === "GET" &&
    h.get("dnt") !== "1" &&
    h.get("sec-gpc") !== "1" &&
    !/prefetch|prerender/i.test(purpose) &&
    !h.has("next-router-prefetch") &&
    ua.length > 0 &&
    !BOT_UA.test(ua);

  const day = utcDay();
  const visitorHash = createHash("sha256")
    .update(`${hashSecret()}|${day}|${clientIp(h)}|${ua}`)
    .digest("hex")
    .slice(0, 32);

  let referrerHost: string | null = null;
  try {
    const ref = h.get("referer");
    if (ref) referrerHost = new URL(ref).hostname.toLowerCase().replace(/^www\./, "").slice(0, 255) || null;
  } catch {}

  return { track, visitorHash, referrerHost, day };
}

/** Count a click. Repeat clicks by the same visitor on the same day bump
 *  `clicks` but never the visitor count. */
export async function recordClick(productId: string, source: OutboundSource, ctx: ClickContext): Promise<void> {
  if (!ctx.track) return;
  await ensureOutboundTables();
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO "OutboundClick" ("id", "productId", "source", "day", "visitorHash", "referrerHost", "clicks", "createdAt", "lastClickAt")
    VALUES (${randomUUID()}, ${productId}, ${source}, ${ctx.day}::date, ${ctx.visitorHash}, ${ctx.referrerHost}, 1, ${now}, ${now})
    ON CONFLICT ("productId", "day", "source", "visitorHash") DO UPDATE
       SET "clicks" = "OutboundClick"."clicks" + 1,
           "lastClickAt" = EXCLUDED."lastClickAt"`;
}
