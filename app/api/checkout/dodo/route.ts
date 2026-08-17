import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createDodoPlacementCheckout, PlacementTier, PLACEMENT_TIERS } from "@/lib/dodopayments";
import { slugify } from "@/app/data";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHENTICATED", message: "Please sign in to complete checkout" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { productId, submissionId, tier, returnTo } = body as {
      productId?: string;
      submissionId?: string;
      tier: PlacementTier;
      returnTo?: "profile" | "submit";
    };

    if (!productId && !submissionId) {
      return NextResponse.json({ error: "MISSING_TARGET", message: "Product or submission ID is required" }, { status: 400 });
    }

    if (tier !== 5 && tier !== 10) {
      return NextResponse.json({ error: "INVALID_TIER", message: "Tier must be $5 or $10" }, { status: 400 });
    }

    let targetName = "";
    let targetSlug = "";
    const targetProductId = productId;
    const targetSubmissionId = submissionId;

    if (submissionId) {
      const sub = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          ownerId: user.id,
        },
      });

      if (!sub) {
        return NextResponse.json({ error: "SUBMISSION_NOT_FOUND", message: "Submission not found or access denied" }, { status: 404 });
      }

      targetName = sub.name;
      targetSlug = slugify(sub.name);
    } else if (productId) {
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          OR: [
            { ownerId: user.id },
            { makers: { some: { userId: user.id } } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      if (!product) {
        return NextResponse.json({ error: "PRODUCT_NOT_FOUND", message: "Product not found or access denied" }, { status: 404 });
      }

      targetName = product.name;
      targetSlug = product.slug;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com";

    const result = await createDodoPlacementCheckout({
      userId: user.id,
      userEmail: user.email,
      userName: user.name || user.username,
      productId: targetProductId,
      submissionId: targetSubmissionId,
      productName: targetName,
      productSlug: targetSlug,
      tier,
      appUrl,
      returnTo: returnTo || (submissionId ? "submit" : "profile"),
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
      purchaseId: result.purchaseId,
      isSandbox: result.isSandbox,
      tierConfig: PLACEMENT_TIERS[tier],
    });
  } catch (error: any) {
    console.error("[api/checkout/dodo] error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: error.message || "Failed to initialize Dodo checkout" }, { status: 500 });
  }
}
