/**
 * Sidebar Spotlight ("RAIL"): the sponsored slots above "Top by category" on
 * every page with rails.
 *
 * Pricing: $1 per 3-day block, bought in any number of blocks. Dodo charges a
 * single $1 product (DODO_PRODUCT_ID_RAIL) with quantity = blocks.
 *
 * Every booking goes live the moment payment is confirmed and runs for the
 * days bought. The sidebar shows RAIL_VISIBLE_SLOTS (4) at a time; with more
 * live bookings than that it rotates through them every 15 seconds
 * (app/MainLayoutShell.tsx).
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

/** Creates the pending purchase and a Dodo checkout for `blocks` × 3 days. */
export async function createRailCheckout({
  user,
  target,
  blocks,
  appUrl,
}: {
  user: { id: string; email: string; name: string };
  target: { productId?: string; submissionId?: string; name: string };
  blocks: number;
  appUrl: string;
}) {
  const quote = railQuote(blocks);
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
      productId: target.productId ?? null,
      submissionId: target.submissionId ?? null,
    },
  });

  const returnUrl = `${appUrl}/spotlight/book?checkout=success&purchaseId=${purchase.id}&payment_id={payment_id}`;

  const client = getDodoClient();
  if (client) {
    try {
      const session = await client.checkoutSessions.create({
        product_cart: [{ product_id: railDodoProductId(), quantity: quote.blocks }],
        customer: { email: user.email, name: user.name },
        return_url: returnUrl,
        metadata: {
          purchaseId: purchase.id,
          userId: user.id,
          placement: "RAIL",
          days: String(quote.days),
          productId: target.productId || "",
          submissionId: target.submissionId || "",
          productName: target.name,
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
  return {
    checkoutUrl: returnUrl.replace("{payment_id}", ""),
    purchaseId: purchase.id,
    isSandbox: true,
    ...quote,
  };
}

/**
 * Turns a paid RAIL purchase into its slot. Idempotent: the webhook and the
 * return-page verify may both call it. Callers must have confirmed payment.
 */
export async function activateRailSlot(purchaseId: string, paymentId?: string) {
  const purchase = await prisma.featuredPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || purchase.position !== "RAIL") return null;

  if (purchase.status !== "PAID") {
    await prisma.featuredPurchase.update({
      where: { id: purchase.id },
      data: { status: "PAID", stripePaymentIntentId: paymentId || purchase.stripePaymentIntentId },
    });
  }

  const existing = await prisma.featuredSlot.findFirst({ where: { purchaseId: purchase.id } });
  if (existing) return existing;

  // What is being promoted: a product the buyer owns, or their submission.
  let productId: string | null = null;
  let custom: { customName?: string; customTagline?: string; customLogoUrl?: string | null; customUrl?: string | null } = {};
  if (purchase.productId) {
    const product = await prisma.product.findUnique({ where: { id: purchase.productId }, select: { id: true } });
    productId = product?.id ?? null;
  }
  if (!productId && purchase.submissionId) {
    const sub = await prisma.submission.findUnique({ where: { id: purchase.submissionId } });
    if (sub) {
      productId = sub.publishedProductId ?? null;
      custom = {
        customName: sub.name,
        customTagline: sub.tagline,
        customLogoUrl: sub.logoUrl,
        customUrl: normalizeMakerUrl(sub.websiteUrl),
      };
    }
  }
  if (!productId && !custom.customName) {
    console.error("[rail-spotlight] paid purchase has no product or submission:", purchase.id);
    return null;
  }

  const days = purchase.days ?? RAIL_DAYS_PER_BLOCK;
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * DAY_MS);

  try {
    const slot = await prisma.featuredSlot.create({
      data: {
        kind: "PAID",
        position: "RAIL",
        order: 0,
        productId,
        ...custom,
        startsAt,
        endsAt,
        purchaseId: purchase.id,
      },
    });
    invalidateSlotsCache();
    return slot;
  } catch (err: any) {
    if (err?.code === "P2002") return prisma.featuredSlot.findFirst({ where: { purchaseId: purchase.id } });
    throw err;
  }
}
