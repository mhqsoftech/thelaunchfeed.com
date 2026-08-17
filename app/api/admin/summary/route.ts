import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Everything the admin dashboard's Overview / Products / Users / Founder /
 * Revenue tabs need. Gated to the admin only.
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [products, users] = await Promise.all([
    prisma.product.findMany({
      where: { status: "LIVE" },
      orderBy: { voteCount: "desc" },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        voteCount: true,
        launchedAt: true,
        owner: { select: { username: true, name: true } },
        category: { select: { name: true, slug: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        image: true,
        _count: { select: { products: true, votes: true } },
      },
    }),
  ]);

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      votes: p.voteCount,
      maker: `@${p.owner.username}`,
      makerName: p.owner.name || p.owner.username,
      category: p.category?.slug ?? "uncategorized",
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name || u.username,
      username: u.username,
      handle: `@${u.username}`,
      email: u.email,
      role: u.role.toLowerCase(),
      avatar: (u.name || u.username).slice(0, 2).toUpperCase(),
      image: u.image,
      productCount: u._count.products,
      voteCount: u._count.votes,
    })),
  });
}
