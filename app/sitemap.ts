import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

/**
 * Dynamic sitemap. Regenerates dynamically based on actual database timestamps
 * so that new products, founders, and category updates reflect the exact moment
 * they go live.
 *
 * Sections:
 *   - Static core routes (home, founders leaderboard, submit) with dynamic live timestamps
 *   - One entry per LIVE Product with exact updatedAt / launchedAt timestamp
 *   - One entry per public Founder profile with exact updatedAt timestamp
 *   - One entry per Category with exact latest product launch/update timestamp
 */

export const revalidate = 60; // 1 minute revalidation for real-time freshness

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [products, users, categories] = await Promise.all([
    prisma.product.findMany({
      where: { status: "LIVE" },
      select: {
        slug: true,
        updatedAt: true,
        launchedAt: true,
        createdAt: true,
        voteCount: true,
      },
      orderBy: { launchedAt: "desc" },
      take: 5000,
    }),
    prisma.user.findMany({
      where: { isProfilePublic: true },
      select: {
        username: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
    prisma.category.findMany({
      select: {
        slug: true,
        createdAt: true,
        products: {
          where: { status: "LIVE" },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { updatedAt: true, launchedAt: true },
        },
      },
    }),
  ]);

  // Exact live timestamps for root and leaderboard pages
  const latestProductTimestamp = products[0]?.updatedAt || products[0]?.launchedAt || products[0]?.createdAt || now;
  const latestFounderTimestamp = users[0]?.updatedAt || users[0]?.createdAt || now;

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${APP_URL}/`,
      lastModified: new Date(latestProductTimestamp),
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${APP_URL}/founders`,
      lastModified: new Date(latestFounderTimestamp),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/submit`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${APP_URL}/about`,
      lastModified: new Date("2026-08-15T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${APP_URL}/contact`,
      lastModified: new Date("2026-08-15T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${APP_URL}/privacy`,
      lastModified: new Date("2026-08-15T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${APP_URL}/terms`,
      lastModified: new Date("2026-08-15T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  // Exact timestamp when product was launched or updated
  const productRoutes: MetadataRoute.Sitemap = products.map((p) => {
    const lastMod = p.updatedAt || p.launchedAt || p.createdAt || now;
    return {
      url: `${APP_URL}/product/${encodeURIComponent(p.slug)}`,
      lastModified: new Date(lastMod),
      changeFrequency: "daily" as const,
      priority: Math.min(0.95, Math.max(0.5, 0.5 + (p.voteCount || 0) / 500)),
    };
  });

  // Exact timestamp when founder profile was created or updated
  const founderRoutes: MetadataRoute.Sitemap = users
    .filter((u) => u.username && u.username.trim().length > 0)
    .map((u) => {
      const lastMod = u.updatedAt || u.createdAt || now;
      return {
        url: `${APP_URL}/founder/${encodeURIComponent(u.username.replace(/^@/, "").trim())}`,
        lastModified: new Date(lastMod),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      };
    });

  // Exact timestamp of the latest product launched or updated inside this category
  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => {
    const latestProductInCategory = c.products[0];
    const lastMod = latestProductInCategory?.updatedAt || latestProductInCategory?.launchedAt || c.createdAt || now;
    return {
      url: `${APP_URL}/category/${encodeURIComponent(c.slug)}`,
      lastModified: new Date(lastMod),
      changeFrequency: "daily" as const,
      priority: 0.7,
    };
  });

  return [...staticRoutes, ...productRoutes, ...founderRoutes, ...categoryRoutes];
}
