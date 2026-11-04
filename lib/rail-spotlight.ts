/**
 * Sidebar Spotlight ("RAIL"): the sponsored slots above "Top by category" on
 * every page with rails.
 *
 * Pricing: $1 per product per 3-day block. One booking can sponsor several
 * products (RAIL_MAX_ITEMS) for the same number of days; Dodo charges a
 * single $1 product (DODO_PRODUCT_ID_RAIL) with quantity = blocks × products,
 * and each product gets its own slot (FeaturedSlot.purchaseItem).
 *
 * A product can be one the buyer has listed here, a launch they have
 * scheduled, or any other site ("custom": URL, name, tagline, icon).
 *
 * Every slot goes live the moment payment is confirmed and runs for the days
 * bought. The sidebar shows RAIL_VISIBLE_SLOTS (4) at a time; with more live
 * bookings it rotates through them every 15 seconds (app/MainLayoutShell.tsx).
 */

import { prisma } from "@/lib/db";
import { getDodoClient, normalizeMakerUrl, sandboxCheckoutEnabled } from "@/lib/dodopayments";
import { invalidateSlotsCache } from "@/lib/queries/slots";
import { RAIL_DAYS_PER_BLOCK, railQuote } from "./rail-spotlight-shared";

export {
  RAIL_VISIBLE_SLOTS,
  RAIL_ROTATE_MS,
  RAIL_DAYS_PER_BLOCK,
  RAIL_PRICE_PER_BLOCK_CENTS,
  RAIL_MAX_BLOCKS,
  RAIL_MAX_ITEMS,
  railQuote,
} from "./rail-spotlight-shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const SANDBOX_SESSION_PREFIX = "dodo_sess_";

export function railDodoProductId() {
  return process.env.DODO_PRODUCT_ID_RAIL || "pdt_tlf_rail_spotlight_3d";
}

/** Sidebar bookings live right now. */
export async function countLiveRailBookings(now = new Date()) {
  return prisma.featuredSlot.count({
    where: { position: "RAIL", startsAt: { lte: now }, endsAt: { gt: now } },
  });
}

/* ─────────── what a booking sponsors ─────────── */

export type CustomSpotlightProduct = { url: string; name: string; tagline: string; logoUrl: string | null };

export type RailItem =
  | { type: "product"; productId: string }
  | { type: "submission"; submissionId: string }
  | ({ type: "custom" } & CustomSpotlightProduct);

/** The items a purchase paid for, including purchases made before a
 *  booking could hold several products. */
export function railItemsOf(purchase: {
  details: unknown;
  productId: string | null;
  submissionId: string | null;
}): RailItem[] {
  const d = (purchase.details ?? {}) as { items?: RailItem[]; custom?: CustomSpotlightProduct };
  if (Array.isArray(d.items) && d.items.length > 0) return d.items;
  if (purchase.productId) return [{ type: "product", productId: purchase.productId }];
  if (purchase.submissionId) return [{ type: "submission", submissionId: purchase.submissionId }];
  if (d.custom) return [{ type: "custom", ...d.custom }];
  return [];
}

/* ─────────── custom products (not listed on The Launch Feed) ─────────── */

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Trim to `max` characters at a word boundary. */
function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}

const ICON_TYPES = /^image\/(png|jpe?g|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon|avif)$/;
const MAX_ICON_BYTES = 500_000;

/**
 * Reads a site's name, tagline and icon for the booking form. One page,
 * SSRF-guarded fetch, no AI step. Returns null for an address that can't be
 * used (not http(s), or internal); `fetched: false` when the site couldn't
 * be read, so the buyer fills the details in themselves.
 */
export async function previewCustomProduct(
  rawUrl: string
): Promise<{ product: CustomSpotlightProduct; fetched: boolean } | null> {
  const url = normalizeMakerUrl(rawUrl);
  if (!url) return null;
  const { assertSafeUrl } = await import("@/lib/ssrf");
  if (!(await assertSafeUrl(url)).ok) return null;

  const host = new URL(url).hostname.replace(/^www\./, "");
  const label = host.split(".")[0];
  const fallbackName = label.replace(/^./, (c) => c.toUpperCase());

  const { fetchSiteMeta } = await import("@/app/lib/autofill/crawler");
  const meta = await fetchSiteMeta(url).catch(() => null);
  if (!meta) return { product: { url, name: fallbackName, tagline: "", logoUrl: null }, fetched: false };

  // Name: the site's declared name, else the title segment that matches the
  // domain ("Agentic Infrastructure – Vercel" → "Vercel"), else the first
  // short segment, else the domain itself.
  const title = clean(meta.title, 200);
  const parts = title.split(/\s+[|–—:·-]\s+/).map((t) => t.trim()).filter(Boolean);
  const squash = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const declared = clean(meta.siteName, 60);
  const matching = parts.find((t) => t.length <= 40 && (squash(t).includes(label.toLowerCase()) || label.toLowerCase().includes(squash(t))));
  const first = parts[0] && parts[0].length <= 40 && !/^(home|welcome|index)$/i.test(parts[0]) ? parts[0] : "";
  const name = declared || matching || first || fallbackName;
  const rest = parts.filter((t) => t !== name).join(" ");

  return {
    product: {
      url,
      name: clip(name, 60),
      tagline: clip(clean(meta.description, 300) || rest, 120),
      logoUrl: meta.icon || new URL("/favicon.ico", url).toString(),
    },
    fetched: true,
  };
}

/** Validates a custom product the buyer submitted. The icon may be an
 *  http(s) URL (fetched from the site) or an uploaded image as a data URI. */
export function parseCustomProduct(input: unknown): CustomSpotlightProduct | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const url = normalizeMakerUrl(typeof o.url === "string" ? o.url : "");
  const name = clean(o.name, 60);
  const tagline = clean(o.tagline, 140);
  let logo: string | null = null;
  if (typeof o.logoUrl === "string") {
    const m = o.logoUrl.match(/^data:([^;,]+);base64,/);
    if (m) logo = ICON_TYPES.test(m[1]) && o.logoUrl.length < MAX_ICON_BYTES * 1.4 ? o.logoUrl : null;
    else logo = normalizeMakerUrl(o.logoUrl);
  }
  if (!url || !name) return null;
  return { url, name, tagline, logoUrl: logo };
}

function iconExt(type: string) {
  return type.includes("svg") ? "svg" : type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("jp") ? "jpg" : type.includes("gif") ? "gif" : type.includes("avif") ? "avif" : "ico";
}

/**
 * Puts the product's icon in our storage so the slot never depends on the
 * other site serving it. An uploaded image is stored or dropped; a fetched
 * one falls back to its original https URL when storage isn't available.
 */
export async function storeCustomIcon(icon: string | null, key: string): Promise<string | null> {
  if (!icon) return null;
  const upload = async (buf: Buffer, type: string) => {
    const { uploadToNeonStorage } = await import("@/lib/storage");
    return uploadToNeonStorage(buf, `spotlight/${key}.${iconExt(type)}`, type);
  };

  if (icon.startsWith("data:")) {
    const m = icon.match(/^data:([^;,]+);base64,(.+)$/);
    if (!m || !ICON_TYPES.test(m[1])) return null;
    const buf = Buffer.from(m[2], "base64");
    if (buf.byteLength === 0 || buf.byteLength > MAX_ICON_BYTES) return null;
    try {
      return await upload(buf, m[1]);
    } catch (err) {
      console.warn("[rail-spotlight] uploaded icon could not be stored:", err);
      return null;
    }
  }

  try {
    const { safeFetch } = await import("@/lib/ssrf");
    const res = await safeFetch(icon, { timeoutMs: 6000, headers: { accept: "image/*" } });
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!res.ok || !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_ICON_BYTES * 2) return null;
    try {
      return await upload(buf, type);
    } catch (err) {
      console.warn("[rail-spotlight] icon upload failed, keeping the original URL:", err);
      return icon.startsWith("https://") ? icon : null;
    }
  } catch {
    return null;
  }
}

/* ─────────── checkout ─────────── */

/** Creates the pending purchase and a Dodo checkout: `items.length`
 *  products × `blocks` × 3 days. */
export async function createRailCheckout({
  user,
  items,
  label,
  blocks,
  appUrl,
}: {
  user: { id: string; email: string; name: string };
  items: RailItem[];
  /** Shown in Dodo's metadata, e.g. "Linear, Resend". */
  label: string;
  blocks: number;
  appUrl: string;
}) {
  const quote = railQuote(blocks, items.length);
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const purchase = await prisma.featuredPurchase.create({
    data: {
      id: `dodo_rail_${suffix}`,
      userId: user.id,
      stripeSessionId: `${SANDBOX_SESSION_PREFIX}${suffix}`,
      amountCents: quote.amountCents,
      currency: "usd",
      status: "PENDING",
      position: "RAIL",
      days: quote.days,
      details: { items },
    },
  });

  const returnUrl = `${appUrl}/spotlight/book?checkout=success&purchaseId=${purchase.id}&payment_id={payment_id}`;

  const client = getDodoClient();
  if (client) {
    try {
      const session = await client.checkoutSessions.create({
        product_cart: [{ product_id: railDodoProductId(), quantity: quote.quantity }],
        customer: { email: user.email, name: user.name },
        return_url: returnUrl,
        metadata: {
          purchaseId: purchase.id,
          userId: user.id,
          placement: "RAIL",
          days: String(quote.days),
          products: String(quote.products),
          productName: label.slice(0, 200),
        },
      });
      if (session.checkout_url) {
        await prisma.featuredPurchase.update({
          where: { id: purchase.id },
          data: { stripeSessionId: session.session_id || session.payment_id || purchase.stripeSessionId },
        });
        return { checkoutUrl: session.checkout_url, purchaseId: purchase.id, isSandbox: false, ...quote };
      }
    } catch (err) {
      console.warn("[rail-spotlight] Dodo checkout session failed:", err);
    }
  }

  if (!sandboxCheckoutEnabled()) {
    await prisma.featuredPurchase.update({ where: { id: purchase.id }, data: { status: "FAILED" } });
    throw new Error("Checkout is unavailable right now. Please try again in a few minutes.");
  }

  // Local dev: no real checkout. The return page verifies the purchase, and a
  // sandbox session counts as paid (confirmPlacementPayment).
  return { checkoutUrl: returnUrl.replace("{payment_id}", ""), purchaseId: purchase.id, isSandbox: true, ...quote };
}

/* ─────────── activation ─────────── */

type SlotFields = {
  productId: string | null;
  customName?: string;
  customTagline?: string;
  customLogoUrl?: string | null;
  customUrl?: string | null;
};

/** Slot fields for one item. Every link points at the product's own
 *  website (its original URL), never at a page on The Launch Feed. */
async function slotFieldsFor(item: RailItem): Promise<SlotFields | null> {
  if (item.type === "product") {
    const p = await prisma.product.findUnique({ where: { id: item.productId }, select: { id: true, websiteUrl: true } });
    return p ? { productId: p.id, customUrl: normalizeMakerUrl(p.websiteUrl) } : null;
  }
  if (item.type === "submission") {
    const sub = await prisma.submission.findUnique({ where: { id: item.submissionId } });
    return sub
      ? {
          productId: sub.publishedProductId ?? null,
          customName: sub.name,
          customTagline: sub.tagline,
          customLogoUrl: sub.logoUrl,
          customUrl: normalizeMakerUrl(sub.websiteUrl),
        }
      : null;
  }
  const c = parseCustomProduct(item);
  return c ? { productId: null, customName: c.name, customTagline: c.tagline, customLogoUrl: c.logoUrl, customUrl: c.url } : null;
}

/**
 * Turns a paid RAIL purchase into one slot per product. Idempotent: the
 * webhook and the return-page verify may both call it, and a slot that
 * already exists for an item is never created twice (unique on
 * purchaseId + purchaseItem). Callers must have confirmed payment.
 */
export async function activateRailSlot(purchaseId: string, paymentId?: string) {
  const purchase = await prisma.featuredPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || purchase.position !== "RAIL") return [];

  if (purchase.status !== "PAID") {
    await prisma.featuredPurchase.update({
      where: { id: purchase.id },
      data: { status: "PAID", stripePaymentIntentId: paymentId || purchase.stripePaymentIntentId },
    });
  }

  const items = railItemsOf(purchase);
  const existing = await prisma.featuredSlot.findMany({ where: { purchaseId: purchase.id }, select: { purchaseItem: true } });
  const done = new Set(existing.map((s) => s.purchaseItem));

  const days = purchase.days ?? RAIL_DAYS_PER_BLOCK;
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * DAY_MS);
  let created = 0;

  for (const [i, item] of items.entries()) {
    if (done.has(i)) continue;
    const fields = await slotFieldsFor(item);
    if (!fields || (!fields.productId && !fields.customName)) {
      console.error("[rail-spotlight] paid item has nothing to show:", purchase.id, i);
      continue;
    }
    try {
      await prisma.featuredSlot.create({
        data: {
          kind: "PAID",
          position: "RAIL",
          order: 0,
          ...fields,
          startsAt,
          endsAt,
          purchaseId: purchase.id,
          purchaseItem: i,
        },
      });
      created++;
    } catch (err: any) {
      if (err?.code !== "P2002") throw err; // a concurrent activation made it
    }
  }

  if (created > 0) invalidateSlotsCache();
  return prisma.featuredSlot.findMany({ where: { purchaseId: purchase.id }, orderBy: { purchaseItem: "asc" } });
}
