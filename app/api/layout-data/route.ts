import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicSlots, getSlotsCacheVersion } from "@/lib/queries/slots";
import { getTopFounders } from "@/lib/queries/founders";

import { getCategoriesWithCounts } from "@/lib/queries/categories";
import { heartbeat } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const revalidate = 30;
// Headroom for the traffic heartbeat that runs after the response.
export const maxDuration = 60;

let layoutServerCache: {
  timestamp: number;
  slotsVersion: number;
  data: any;
} | null = null;
const LAYOUT_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Everything the MainLayoutShell needs to render — pulled once per
 * visit and refreshed on tab focus. Kept intentionally small so the
 * layout stays snappy.
 */
export async function GET() {
  // Every visit doubles as a scheduler heartbeat (throttled to ~1/min across
  // all instances), so launches publish on time even with no external pinger.
  after(() => heartbeat("traffic").catch((err) => console.error("[jobs] heartbeat failed:", err)));

  try {
    if (
      layoutServerCache &&
      layoutServerCache.slotsVersion === getSlotsCacheVersion() &&
      Date.now() - layoutServerCache.timestamp < LAYOUT_CACHE_TTL_MS
    ) {
      return NextResponse.json(layoutServerCache.data, {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      });
    }

    const slotsVersionAtStart = getSlotsCacheVersion();
    const now = new Date();
    const weekStart = new Date(Date.now() - 7 * 86400 * 1000);
    const monthStart = new Date(Date.now() - 30 * 86400 * 1000);

    const [
      featured,
      rotating,
      rail,
      weeklyProducts,
      monthlyProducts,
      categories,
      topFounders,
      directoryEmbeds,
    ] = await Promise.all([
      getPublicSlots("FEATURED").catch(() => []),
      getPublicSlots("ROTATING").catch(() => []),
      getPublicSlots("RAIL").catch(() => []),
      // Top products this week (left rail)
      prisma.product
        .findMany({
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
            websiteUrl: true,
            owner: { select: { username: true, name: true } },
            category: { select: { name: true, slug: true } },
          },
        })
        .catch(() => []),
      // Top products this month (for monthly filter)
      prisma.product
        .findMany({
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
            websiteUrl: true,
            owner: { select: { username: true, name: true } },
            category: { select: { name: true, slug: true } },
          },
        })
        .catch(() => []),
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

    // Organic fallback cards also go to the maker's real website.
    const shapeSlot = (p: any, prefix: string) => {
      const site = typeof p.websiteUrl === "string" ? p.websiteUrl.trim() : "";
      return {
        id: `${prefix}-${p.id}`,
        kind: "CUSTOM" as const,
        name: p.name,
        tagline: p.tagline,
        url: site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : `/product/${p.slug}`,
        external: Boolean(site),
        logoUrl: p.logoUrl ?? null,
        productSlug: p.slug ?? null,
      };
    };

    const finalFeatured =
      featured.length > 0
        ? featured
        : monthlyProducts.slice(0, 8).map((p) => shapeSlot(p, "feat"));

    const finalRotating =
      rotating.length > 0
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
      // Sidebar Spotlight: only real bookings, never filled with fallbacks.
      // The shell shows 4 at a time and rotates through the rest.
      rail,
      topProducts: weeklyProducts.map(shapeProduct),
      weeklyProducts: weeklyProducts.map(shapeProduct),
      monthlyProducts: monthlyProducts.map(shapeProduct),
      categories: mappedCategories,
      topFounders: (topFounders || []).slice(0, 50),
      directoryEmbeds,
    };

    layoutServerCache = { timestamp: Date.now(), slotsVersion: slotsVersionAtStart, data: responseData };

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    console.error("Layout data GET error:", err);
    return NextResponse.json(
      {
        featured: [],
        rotating: [],
        rail: [],
        topProducts: [],
        weeklyProducts: [],
        monthlyProducts: [],
        categories: [],
        topFounders: [],
        directoryEmbeds: [],
      },
      { status: 200 }
    );
  }
}
