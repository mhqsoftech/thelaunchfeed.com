import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLACEMENT_TIERS } from "@/lib/dodopayments";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const now = new Date();

    // 1. Fetch user's products
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { makers: { some: { userId: user.id } } },
        ],
      },
      orderBy: { launchedAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        logoUrl: true,
        status: true,
        launchedAt: true,
        voteCount: true,
      },
    });

    const productIds = products.map((p) => p.id);

    // 2. Fetch all featured slots associated with user's products or purchases
    const slots = await prisma.featuredSlot.findMany({
      where: {
        OR: [
          { productId: { in: productIds } },
          { purchase: { userId: user.id } },
        ],
      },
      orderBy: [{ endsAt: "desc" }, { startsAt: "desc" }],
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            tagline: true,
            logoUrl: true,
            status: true,
          },
        },
        purchase: {
          select: {
            id: true,
            amountCents: true,
            currency: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    // 3. Transform slots with computed days remaining and active status
    const formattedSlots = slots.map((s) => {
      const startsAt = new Date(s.startsAt);
      const endsAt = s.endsAt ? new Date(s.endsAt) : new Date(startsAt.getTime() + 30 * 86400 * 1000);
      const isActive = endsAt.getTime() > now.getTime();
      const msRemaining = Math.max(0, endsAt.getTime() - now.getTime());
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      const totalMs = endsAt.getTime() - startsAt.getTime();
      const elapsedMs = Math.max(0, now.getTime() - startsAt.getTime());
      const percentElapsed = totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 100;

      const tierKey = s.position === "FEATURED" ? 5 : 10;
      const tierInfo = PLACEMENT_TIERS[tierKey];

      return {
        id: s.id,
        position: s.position, // "FEATURED" or "ROTATING"
        tier: tierKey,
        tierName: tierInfo.name,
        headline: tierInfo.headline,
        priceFormatted: tierInfo.priceFormatted,
        kind: s.kind,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        isActive,
        daysRemaining: isActive ? daysRemaining : 0,
        percentElapsed,
        product: s.product,
        purchase: s.purchase,
      };
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name || user.username,
        email: user.email,
      },
      slots: formattedSlots,
      products,
      availableTiers: PLACEMENT_TIERS,
    });
  } catch (error: any) {
    console.error("[api/user/subscriptions] error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
