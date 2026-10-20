import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activatePlacementSlot, confirmPlacementPayment, PlacementTier } from "@/lib/dodopayments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called from the client after Dodo redirects back with a payment_id in the
 * URL. This endpoint is a convenience wrapper around the webhook flow — the
 * webhook is still the source of truth. Dodo redirects here whether or not
 * the payment succeeded, so the payment is confirmed with Dodo before
 * anything is activated. Never trust client-supplied tier, productId,
 * submissionId, or userId: derive everything from the FeaturedPurchase row
 * keyed by purchaseId (and the payment's own metadata), and verify the
 * caller owns it.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    let purchaseId = "";
    let paymentId = "";

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      purchaseId = String(body.purchaseId || "");
      paymentId = String(body.paymentId || "");
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      purchaseId = String(formData.get("purchaseId") || "");
      paymentId = String(formData.get("paymentId") || "");
    }

    if (!purchaseId) {
      return NextResponse.json({ error: "MISSING_PURCHASE_ID" }, { status: 400 });
    }

    const purchase = await prisma.featuredPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) {
      return NextResponse.json({ error: "PURCHASE_NOT_FOUND" }, { status: 404 });
    }
    if (purchase.userId !== user.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Tier is derived from the amount stored when we created the checkout —
    // never from the request body.
    const tier: PlacementTier | null =
      purchase.amountCents === 1000 ? 10 : purchase.amountCents === 500 ? 5 : null;
    if (!tier) {
      return NextResponse.json({ error: "INVALID_TIER" }, { status: 400 });
    }

    const isForm = contentType.includes("application/x-www-form-urlencoded");

    const payment = await confirmPlacementPayment(purchase, paymentId || undefined);
    if (!payment.paid) {
      if (isForm) {
        return NextResponse.redirect(new URL("/profile?tab=products&notice=unpaid", req.url), 303);
      }
      return NextResponse.json(
        { error: "PAYMENT_NOT_COMPLETED", message: "Payment was not completed. Your launch is saved as a draft." },
        { status: 402 }
      );
    }

    // productId / submissionId come from the payment's metadata (set by us
    // at checkout, returned by Dodo) or from state stored on the purchase
    // creation path: a held submission linked to this purchase, a submission
    // already activated with it, or a Product on an already-activated slot.
    const existingSlot = await prisma.featuredSlot.findFirst({ where: { purchaseId: purchase.id } });
    const submissionSelect = { id: true, name: true, scheduledFor: true, status: true, details: true, publishedProductId: true };
    const metaSubmissionId = payment.metadata?.submissionId || "";
    const submission =
      (metaSubmissionId
        ? await prisma.submission.findFirst({ where: { id: metaSubmissionId, ownerId: user.id }, select: submissionSelect })
        : null) ??
      (await prisma.submission.findFirst({
        where: {
          ownerId: user.id,
          OR: [
            { details: { path: ["purchaseId"], equals: purchase.id } },
            { details: { path: ["awaitingPayment", "purchaseId"], equals: purchase.id } },
          ],
        },
        select: submissionSelect,
      }));
    const derivedProductId =
      existingSlot?.productId || submission?.publishedProductId || payment.metadata?.productId || undefined;
    const submissionId = submission?.id || "";

    const slot = await activatePlacementSlot({
      purchaseId: purchase.id,
      paymentId: payment.paymentId || paymentId || undefined,
      userId: user.id,
      productId: derivedProductId,
      submissionId: submissionId || undefined,
      tier,
    });

    if (isForm) {
      if (submissionId) {
        return NextResponse.redirect(
          new URL(`/submit?checkout=success&submissionId=${submissionId}&tier=${tier}`, req.url),
          303
        );
      }
      return NextResponse.redirect(
        new URL(`/profile?tab=subscriptions&checkout=success&tier=${tier}`, req.url),
        303
      );
    }

    return NextResponse.json({
      success: true,
      message: "Placement confirmed successfully for 30 days",
      slot,
      submission: submissionId
        ? await prisma.submission.findUnique({ where: { id: submissionId }, select: submissionSelect })
        : null,
    });
  } catch (error: any) {
    console.error("[api/checkout/dodo/verify] error:", error);
    return NextResponse.json(
      { error: "VERIFICATION_FAILED", message: error.message || "Failed to verify placement activation" },
      { status: 500 }
    );
  }
}
