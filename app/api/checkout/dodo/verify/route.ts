import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activatePlacementSlot, PlacementTier } from "@/lib/dodopayments";

export async function POST(req: Request) {
  try {
    let purchaseId = "";
    let productId = "";
    let submissionId = "";
    let tier: PlacementTier = 5;
    let paymentId = "";
    let returnTo = "";

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      purchaseId = body.purchaseId;
      productId = body.productId;
      submissionId = body.submissionId;
      tier = Number(body.tier) as PlacementTier;
      paymentId = body.paymentId || `dodo_pay_${Date.now()}`;
      returnTo = body.returnTo || (submissionId ? "submit" : "profile");
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      purchaseId = String(formData.get("purchaseId") || "");
      productId = String(formData.get("productId") || "");
      submissionId = String(formData.get("submissionId") || "");
      tier = Number(formData.get("tier") || 5) as PlacementTier;
      paymentId = String(formData.get("paymentId") || `dodo_pay_${Date.now()}`);
      returnTo = String(formData.get("returnTo") || (submissionId ? "submit" : "profile"));
    }

    if ((!productId && !submissionId) || (tier !== 5 && tier !== 10)) {
      return NextResponse.json({ error: "INVALID_PARAMETERS" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const userId = user?.id || "guest";

    const slot = await activatePlacementSlot({
      purchaseId,
      paymentId,
      userId,
      productId: productId || undefined,
      submissionId: submissionId || undefined,
      tier,
    });

    let submission = null;
    if (submissionId) {
      submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { id: true, name: true, scheduledFor: true, status: true, details: true },
      });
    }

    // If submitted via HTML form redirect
    if (contentType.includes("application/x-www-form-urlencoded")) {
      if (returnTo === "submit" && submissionId) {
        return NextResponse.redirect(
          new URL(`/submit?checkout=success&submissionId=${submissionId}&tier=${tier}`, req.url),
          303
        );
      }
      return NextResponse.redirect(
        new URL(`/profile?tab=subscriptions&checkout=success&tier=${tier}&productId=${productId || ""}`, req.url),
        303
      );
    }

    return NextResponse.json({
      success: true,
      message: "Placement confirmed successfully for 30 days",
      slot,
      submission,
    });
  } catch (error: any) {
    console.error("[api/checkout/dodo/verify] error:", error);
    return NextResponse.json(
      { error: "VERIFICATION_FAILED", message: error.message || "Failed to verify placement activation" },
      { status: 500 }
    );
  }
}
