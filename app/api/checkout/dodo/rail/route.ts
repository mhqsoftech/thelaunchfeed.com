import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createRailCheckout, RAIL_MAX_BLOCKS } from "@/lib/rail-spotlight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/dodo/rail
 * Body: { productId?: string, submissionId?: string, blocks: number }
 * Starts a checkout for the sidebar Spotlight: $1 per 3-day block. The
 * promoted item must be a product or submission the signed-in user owns.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHENTICATED", message: "Please sign in to reserve a slot" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { productId?: string; submissionId?: string; blocks?: number };
    const blocks = Number(body.blocks);
    if (!Number.isInteger(blocks) || blocks < 1 || blocks > RAIL_MAX_BLOCKS) {
      return NextResponse.json(
        { error: "INVALID_DURATION", message: `Choose between 1 and ${RAIL_MAX_BLOCKS} blocks of 3 days` },
        { status: 400 }
      );
    }

    let target: { productId?: string; submissionId?: string; name: string } | null = null;
    if (body.productId) {
      const product = await prisma.product.findFirst({
        where: {
          id: body.productId,
          status: "LIVE",
          OR: [{ ownerId: user.id }, { makers: { some: { userId: user.id } } }],
        },
        select: { id: true, name: true },
      });
      if (product) target = { productId: product.id, name: product.name };
    } else if (body.submissionId) {
      const sub = await prisma.submission.findFirst({
        where: { id: body.submissionId, ownerId: user.id, status: { in: ["SCHEDULED", "PUBLISHED"] } },
        select: { id: true, name: true, publishedProductId: true },
      });
      if (sub) target = { submissionId: sub.id, productId: sub.publishedProductId ?? undefined, name: sub.name };
    }
    if (!target) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Pick one of your own products" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const result = await createRailCheckout({
      user: { id: user.id, email: user.email, name: user.name || user.username },
      target,
      blocks,
      appUrl,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[api/checkout/dodo/rail] error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error?.message || "Failed to start checkout" },
      { status: 500 }
    );
  }
}
