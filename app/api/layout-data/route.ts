import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicSlots } from "@/lib/queries/slots";
import { getTopFounders } from "@/lib/queries/founders";

import { getCategoriesWithCounts } from "@/lib/queries/categories";

export const dynamic = "force-dynamic";
export const revalidate = 30;

let layoutServerCache: {
  timestamp: number;
  data: any;
} | null = null;
const LAYOUT_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Everything the MainLayoutShell needs to render — pulled once per
 * visit and refreshed on tab focus. Kept intentionally small so the
 * layout stays snappy.
 */
export async function GET() {
  if (layoutServerCache && Date.now() - layoutServerCache.timestamp < LAYOUT_CACHE_TTL_MS) {
    return NextResponse.json(layoutServerCache.data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  }

  const now = new Date();
  const weekStart = new Date(Date.now() - 7 * 86400 * 1000);
  const monthStart = new Date(Date.now() - 30 * 86400 * 1000);

  const [
    featured,
    rotating,
    weeklyProducts,
    monthlyProducts,
    categories,
    topFounders,
    directoryEmbeds,
  ] = await Promise.all([
    getPublicSlots("FEATURED"),
    getPublicSlots("ROTATING"),
    // Top products this week (left rail)
    prisma.product.findMany({
      where: { status: "LIVE", launchedAt: { gte: weekStart } },
      orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        voteCount: true,
        logoUrl: true,
        owner: { select: { username: true, name: true } },
        category: { select: { name: true, slug: true } },
      },
    }),
    // Top products this month (for monthly filter)
    prisma.product.findMany({
      where: { status: "LIVE", launchedAt: { gte: monthStart } },
      orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        voteCount: true,
        logoUrl: true,
        owner: { select: { username: true, name: true } },
        category: { select: { name: true, slug: true } },
      },
    }),
    // All categories with live product counts for right rail
    getCategoriesWithCounts().catch(() => []),
    // Top 10 builders/founders for right rail
    getTopFounders(50).catch(() => []),
    // Directory Embeds for footer marquee
    prisma.appSetting
      .findUnique({ where: { key: "site.directory_embeds" } })
      .then((row) => {
        if (!row || !Array.isArray(row.value)) return [];
        return (row.value as any[])
          .filter((item) => item && item.enabled !== false && typeof item.embedHtml === "string")
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      })
      .catch(() => []),
  ]);

  const shapeProduct = (p: any) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    logoUrl: p.logoUrl,
    votes: p.voteCount,
    maker: `@${p.owner?.username || "maker"}`,
    makerName: p.owner?.name || p.owner?.username || "Maker",
    category: p.category?.name || "Tech",
    categorySlug: p.category?.slug || "tech",
  });

  const shapeSlot = (p: any, prefix: string) => ({
    id: `${prefix}-${p.id}`,
    name: p.name,
    tagline: p.tagline,
    url: `/product/${p.slug}`,
    logoUrl: p.logoUrl ?? null,
  });

  const finalFeatured = featured.length > 0
    ? featured
    : monthlyProducts.slice(0, 8).map((p) => shapeSlot(p, "feat"));

  const finalRotating = rotating.length > 0
    ? rotating
    : weeklyProducts.slice(0, 8).map((p) => shapeSlot(p, "rot"));

  const mappedCategories = categories.map((c: any) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    productCount: c.productCount ?? c._count?.products ?? 0,
  }));

  const responseData = {
    featured: finalFeatured,
    rotating: finalRotating,
    topProducts: weeklyProducts.map(shapeProduct),
    weeklyProducts: weeklyProducts.map(shapeProduct),
    monthlyProducts: monthlyProducts.map(shapeProduct),
    categories: mappedCategories,
    topFounders: (topFounders || []).slice(0, 50),
    directoryEmbeds,
  };

  layoutServerCache = { timestamp: Date.now(), data: responseData };

  return NextResponse.json(responseData, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
