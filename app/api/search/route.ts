import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFounderScore } from "@/lib/founder-score";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  if (!q) {
    return NextResponse.json({ products: [], founders: [] });
  }

  try {
    const [products, users] = await Promise.all([
      // 1. Search across Products
      prisma.product.findMany({
        where: {
          status: "LIVE",
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { tagline: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { tags: { hasSome: [q] } },
            { category: { name: { contains: q, mode: "insensitive" } } },
            { category: { slug: { contains: q, mode: "insensitive" } } },
            { owner: { name: { contains: q, mode: "insensitive" } } },
            { owner: { username: { contains: q, mode: "insensitive" } } },
          ],
        },
        orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
        take: 16,
        select: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          logoUrl: true,
          voteCount: true,
          category: { select: { slug: true, name: true } },
          owner: { select: { name: true, username: true } },
        },
      }),

      // 2. Search across Founders / Users
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { bio: { contains: q, mode: "insensitive" } },
            { products: { some: { name: { contains: q, mode: "insensitive" } } } },
          ],
        },
        take: 12,
        select: {
          id: true,
          username: true,
          name: true,
          title: true,
          image: true,
          bio: true,
          createdAt: true,
          products: {
            where: { status: "LIVE" },
            select: { id: true, voteCount: true, name: true, slug: true },
          },
          _count: { select: { votes: true } },
        },
      }),
    ]);

    const formattedProducts = products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      logoUrl: p.logoUrl,
      votes: p.voteCount,
      category: p.category?.name ?? "General",
      categorySlug: p.category?.slug ?? "general",
      maker: `@${p.owner.username || "builder"}`,
      makerName: p.owner.name || p.owner.username,
    }));

    const formattedFounders = users.map((u) => {
      const productsCount = u.products.length;
      const totalVotes = u.products.reduce((acc, p) => acc + p.voteCount, 0);
      const votesGiven = (u as any)._count?.votes ?? 0;
      const score = getFounderScore(
        productsCount,
        totalVotes,
        u.createdAt ? u.createdAt.toISOString() : undefined,
        votesGiven
      );

      return {
        id: u.id,
        username: u.username || u.name.toLowerCase().replace(/\s+/g, ""),
        name: u.name || u.username,
        title: u.title || "Independent Builder",
        image: u.image,
        bio: u.bio,
        level: score.currentLevel,
        productsCount,
        totalVotes,
      };
    });

    return NextResponse.json({
      products: formattedProducts,
      founders: formattedFounders,
    });
  } catch (error) {
    console.error("[search api] error:", error);
    return NextResponse.json({ products: [], founders: [] }, { status: 500 });
  }
}
