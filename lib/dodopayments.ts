import DodoPayments from "dodopayments";
import { prisma } from "@/lib/db";
import { invalidateSlotsCache } from "@/lib/queries/slots";
import { slugify } from "@/app/data";

export type PlacementTier = 5 | 10;

export const PLACEMENT_TIERS = {
  5: {
    tier: 5 as PlacementTier,
    name: "Featured Launch",
    headline: "Header Floating Section Placement",
    description: "Your product pinned prominently in the top floating header strip across all platform pages.",
    slotPosition: "FEATURED" as const,
    amountCents: 500,
    priceFormatted: "$5",
    durationDays: 30,
    dodoProductId: process.env.DODO_PRODUCT_ID_5 || "pdt_tlf_featured_5",
  },
  10: {
    tier: 10 as PlacementTier,
    name: "Premium Spotlight Launch",
    headline: "Alternating 15s Spotlight Next to Search & Submit",
    description: "Dynamic 15-second rotating spotlight banner positioned directly beside the search and submit bar.",
    slotPosition: "ROTATING" as const,
    amountCents: 1000,
    priceFormatted: "$10",
    durationDays: 30,
    dodoProductId: process.env.DODO_PRODUCT_ID_10 || "pdt_tlf_spotlight_10",
  },
} as const;

export function getDodoClient(): DodoPayments | null {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  if (!apiKey) return null;
  const isLive =
    process.env.DODO_PAYMENTS_ENV === "live_mode" ||
    process.env.DODO_PAYMENTS_ENV === "live" ||
    process.env.DODO_PAYMENTS_ENV === "production";
  const env: "live_mode" | "test_mode" = isLive ? "live_mode" : "test_mode";
  return new DodoPayments({
    bearerToken: apiKey,
    environment: env,
  });
}

/**
 * Creates a Dodo Payments checkout session for product launch placement ($5 or $10).
 */
export async function createDodoPlacementCheckout({
  userId,
  userEmail,
  userName,
  productId,
  submissionId,
  productName,
  productSlug,
  tier,
  appUrl,
  returnTo = "profile",
}: {
  userId: string;
  userEmail: string;
  userName: string;
  productId?: string;
  submissionId?: string;
  productName: string;
  productSlug: string;
  tier: PlacementTier;
  appUrl: string;
  returnTo?: "profile" | "submit";
}) {
  const config = PLACEMENT_TIERS[tier];
  if (!config) throw new Error(`Invalid placement tier: ${tier}`);

  // Create pending purchase in database
  const purchaseId = `dodo_pur_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const sessionId = `dodo_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const purchase = await prisma.featuredPurchase.create({
    data: {
      id: purchaseId,
      userId,
      stripeSessionId: sessionId,
      amountCents: config.amountCents,
      currency: "usd",
      status: "PENDING",
    },
  });

  const returnUrl =
    returnTo === "submit" && submissionId
      ? `${appUrl}/submit?checkout=success&submissionId=${submissionId}&purchaseId=${purchase.id}&payment_id={payment_id}&tier=${tier}`
      : `${appUrl}/profile?tab=subscriptions&checkout=success&purchaseId=${purchase.id}&payment_id={payment_id}&tier=${tier}&productId=${productId || ""}`;

  const client = getDodoClient();
  if (client) {
    try {
      const session = await client.checkoutSessions.create({
        product_cart: [
          {
            product_id: config.dodoProductId,
            quantity: 1,
            amount: config.amountCents,
          },
        ],
        customer: {
          email: userEmail,
          name: userName,
        },
        return_url: returnUrl,
        metadata: {
          purchaseId: purchase.id,
          userId,
          productId: productId || "",
          submissionId: submissionId || "",
          productName,
          productSlug,
          tier: String(tier),
          slotPosition: config.slotPosition,
        },
      });

      if (session.checkout_url) {
        await prisma.featuredPurchase.update({
          where: { id: purchase.id },
          data: { stripeSessionId: session.session_id || session.payment_id || sessionId },
        });

        return {
          checkoutUrl: session.checkout_url,
          sessionId: session.session_id,
          purchaseId: purchase.id,
          isSandbox: false,
        };
      }
    } catch (err) {
      console.warn("[DodoPayments] Checkout session creation error, using direct checkout redirect:", err);
    }
  }

  // Seamless fallback sandbox checkout URL
  const sandboxCheckoutUrl =
    returnTo === "submit" && submissionId
      ? `${appUrl}/api/checkout/dodo/sandbox?purchaseId=${purchase.id}&submissionId=${submissionId}&tier=${tier}&returnTo=submit`
      : `${appUrl}/api/checkout/dodo/sandbox?purchaseId=${purchase.id}&productId=${productId || ""}&tier=${tier}&returnTo=profile`;

  return {
    checkoutUrl: sandboxCheckoutUrl,
    sessionId: purchase.stripeSessionId,
    purchaseId: purchase.id,
    isSandbox: true,
  };
}

/**
 * Activates a 30-day Featured / Spotlight placement upon successful payment confirmation.
 */
export async function activatePlacementSlot({
  purchaseId,
  paymentId,
  userId: _userId,
  productId,
  submissionId,
  tier,
}: {
  purchaseId?: string;
  paymentId?: string;
  userId: string;
  productId?: string;
  submissionId?: string;
  tier: PlacementTier;
}) {
  const config = PLACEMENT_TIERS[tier];
  if (!config) throw new Error(`Invalid placement tier: ${tier}`);

  // 1. Update purchase status to PAID
  let purchase = null;
  if (purchaseId) {
    purchase = await prisma.featuredPurchase.findUnique({ where: { id: purchaseId } });
  } else if (paymentId) {
    purchase = await prisma.featuredPurchase.findUnique({ where: { stripeSessionId: paymentId } });
  }

  if (purchase) {
    await prisma.featuredPurchase.update({
      where: { id: purchase.id },
      data: {
        status: "PAID",
        stripePaymentIntentId: paymentId || purchase.stripePaymentIntentId,
      },
    });
  }

  const now = new Date();
  const thirtyDaysMs = config.durationDays * 24 * 60 * 60 * 1000;

  // Idempotency: if this purchase already activated a slot, return it.
  // Prevents duplicate PAID rows when verify is called more than once
  // (React strict-mode double-effect, page reloads, webhook + return url race).
  // Backed by a unique index on FeaturedSlot.purchaseId, so racing writers
  // hit P2002 and re-read here instead of both creating a slot.
  const findExisting = async () =>
    purchase?.id
      ? prisma.featuredSlot.findFirst({
          where: { purchaseId: purchase.id },
          include: {
            product: { select: { id: true, name: true, slug: true, tagline: true, logoUrl: true } },
          },
        })
      : null;

  if (purchase?.id) {
    const existingByPurchase = await findExisting();
    if (existingByPurchase) {
      invalidateSlotsCache();
      return existingByPurchase;
    }
  }

  // 2. Case A: Payment was for an already published Product
  if (productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (product) {
      const isProductLive = product.status === "LIVE";
      let startsAt = isProductLive ? now : (product.launchedAt > now ? product.launchedAt : now);
      let endsAt = new Date(startsAt.getTime() + thirtyDaysMs);

      // Check existing active slot to stack / extend
      const existingSlot = await prisma.featuredSlot.findFirst({
        where: {
          productId: product.id,
          position: config.slotPosition,
        },
        orderBy: { endsAt: "desc" },
      });

      if (existingSlot && existingSlot.endsAt && existingSlot.endsAt > now) {
        startsAt = existingSlot.startsAt;
        endsAt = new Date(existingSlot.endsAt.getTime() + thirtyDaysMs);

        const updatedSlot = await prisma.featuredSlot.update({
          where: { id: existingSlot.id },
          data: {
            endsAt,
            kind: "PAID",
            purchaseId: purchase?.id ?? existingSlot.purchaseId,
          },
          include: {
            product: { select: { id: true, name: true, slug: true, tagline: true, logoUrl: true } },
          },
        });

        invalidateSlotsCache();
        return updatedSlot;
      }

      const lastSlot = await prisma.featuredSlot.findFirst({
        where: { position: config.slotPosition },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const nextOrder = (lastSlot?.order ?? -1) + 1;

      try {
        const newSlot = await prisma.featuredSlot.create({
          data: {
            kind: "PAID",
            position: config.slotPosition,
            order: nextOrder,
            productId: product.id,
            startsAt,
            endsAt,
            purchaseId: purchase?.id,
          },
          include: {
            product: { select: { id: true, name: true, slug: true, tagline: true, logoUrl: true } },
          },
        });
        invalidateSlotsCache();
        return newSlot;
      } catch (err: any) {
        // Concurrent activation raced us; re-read the winning slot.
        if (err?.code === "P2002") {
          const winner = await findExisting();
          if (winner) {
            invalidateSlotsCache();
            return winner;
          }
        }
        throw err;
      }
    }
  }

  // 3. Case B: Payment was for a pending/scheduled Submission
  if (submissionId) {
    const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (sub) {
      // Update submission details with paid tier info
      const prevDetails = (sub.details as Record<string, unknown>) || {};
      await prisma.submission.update({
        where: { id: sub.id },
        data: {
          details: {
            ...prevDetails,
            launchTier: tier,
            isPaidPlacement: true,
            purchaseId: purchase?.id,
          },
        },
      });

      // Compute slot window starting at scheduled release time
      const startsAt = sub.scheduledFor > now ? sub.scheduledFor : now;
      const endsAt = new Date(startsAt.getTime() + thirtyDaysMs);

      const lastSlot = await prisma.featuredSlot.findFirst({
        where: { position: config.slotPosition },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const nextOrder = (lastSlot?.order ?? -1) + 1;

      try {
        const newSlot = await prisma.featuredSlot.create({
          data: {
            kind: "PAID",
            position: config.slotPosition,
            order: nextOrder,
            productId: sub.publishedProductId || null,
            customName: sub.name,
            customTagline: sub.tagline,
            customLogoUrl: sub.logoUrl,
            customUrl: `/product/${slugify(sub.name)}`,
            startsAt,
            endsAt,
            purchaseId: purchase?.id,
          },
        });
        invalidateSlotsCache();
        return newSlot;
      } catch (err: any) {
        if (err?.code === "P2002") {
          const winner = await findExisting();
          if (winner) {
            invalidateSlotsCache();
            return winner;
          }
        }
        throw err;
      }
    }
  }

  invalidateSlotsCache();
  return null;
}
