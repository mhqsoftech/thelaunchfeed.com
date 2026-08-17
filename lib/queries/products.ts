import { cache } from "react";
import { prisma } from "@/lib/db";
import { formatProductWebsiteUrl } from "@/app/data";

import {
  getDailyCycleRange,
  getWeeklyCycleRange,
  getMonthlyCycleRange,
  getYearlyCycleRange,
} from "@/lib/schedule";

export type TimeframeTab = "daily" | "weekly" | "monthly" | "yearly" | "alltime";

let delistedCache: { data: string[]; timestamp: number } | null = null;
const DELISTED_CACHE_TTL = 60_000; // 60s

export async function getDelistedSections(): Promise<string[]> {
  if (delistedCache && Date.now() - delistedCache.timestamp < DELISTED_CACHE_TTL) {
    return delistedCache.data;
  }
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: "feed.delisted_sections" },
    });
    const data = row && Array.isArray(row.value) ? (row.value as string[]) : [];
    delistedCache = { data, timestamp: Date.now() };
    return data;
  } catch (e) {
    console.error("[getDelistedSections] error:", e);
    return delistedCache ? delistedCache.data : [];
  }
}

/**
 * Filter that strictly matches genuine user launches (products created from submissions).
 * Unlinked seed / demo products have `fromSubmission: null` and are excluded when a section is delisted.
 */
export const GENUINE_PRODUCT_FILTER = {
  fromSubmission: { isNot: null },
};

export async function getDailyProducts(date: Date = new Date()) {
  const delistedSections = await getDelistedSections();
  const isDelisted = delistedSections.includes("daily") || delistedSections.includes("all");

  const cycle = getDailyCycleRange(date);

  const whereCondition: any = {
    status: "LIVE",
    launchedAt: { gte: cycle.start, lt: cycle.end },
    ...(isDelisted ? GENUINE_PRODUCT_FILTER : {}),
  };

  const todays = await prisma.product.findMany({
    where: whereCondition,
    include: {
      owner: { select: { username: true, name: true, image: true } },
      category: { select: { name: true, slug: true } },
      votes: { where: { isFlagged: false }, select: { weight: true } },
    },
    orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
  });

  // If not delisted and fewer than 15 items, top up with other live products.
  let products = todays;
  if (!isDelisted && todays.length < 15) {
    const seenIds = new Set(todays.map((p) => p.id));
    const fillers = await prisma.product.findMany({
      where: { status: "LIVE", id: { notIn: Array.from(seenIds) } },
      take: 15 - todays.length,
      include: {
        owner: { select: { username: true, name: true, image: true } },
        category: { select: { name: true, slug: true } },
        votes: { where: { isFlagged: false }, select: { weight: true } },
      },
      orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
    });
    products = [...todays, ...fillers];
  }

  return products
    .map((p, i) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      logoUrl: p.logoUrl,
      websiteUrl: formatProductWebsiteUrl(p.websiteUrl),
      voteCount: p.voteCount,
      commentCount: p.commentCount,
      launchedAt: p.launchedAt,
      tags: p.tags,
      category: p.category?.name ?? "Tech",
      owner: p.owner,
      score: p.voteCount,
      rank: i + 1,
    }));
}

export async function getWeeklyProducts(date: Date = new Date()) {
  const delistedSections = await getDelistedSections();
  const isDelisted = delistedSections.includes("weekly") || delistedSections.includes("all");

  const cycle = getWeeklyCycleRange(date);

  const whereCondition: any = {
    status: "LIVE",
    launchedAt: { gte: cycle.start, lt: cycle.end },
    ...(isDelisted ? GENUINE_PRODUCT_FILTER : {}),
  };

  let products = await prisma.product.findMany({
    where: whereCondition,
    include: {
      owner: { select: { username: true, name: true, image: true } },
      category: { select: { name: true, slug: true } },
      votes: {
        where: { isFlagged: false, createdAt: { gte: cycle.start, lt: cycle.end } },
        select: { weight: true, isFlagged: true },
      },
    },
    orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
  });

  if (!isDelisted && products.length < 15) {
    const seenIds = new Set(products.map((p) => p.id));
    const fillers = await prisma.product.findMany({
      where: { status: "LIVE", id: { notIn: Array.from(seenIds) } },
      take: 15 - products.length,
      include: {
        owner: { select: { username: true, name: true, image: true } },
        category: { select: { name: true, slug: true } },
        votes: {
          where: { isFlagged: false },
          select: { weight: true, isFlagged: true },
        },
      },
      orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
    });
    products = [...products, ...fillers];
  }

  return products
    .map((p, i) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      logoUrl: p.logoUrl,
      websiteUrl: formatProductWebsiteUrl(p.websiteUrl),
      voteCount: p.voteCount,
      commentCount: p.commentCount,
      launchedAt: p.launchedAt,
      tags: p.tags,
      category: p.category?.name ?? "Tech",
      owner: p.owner,
      score: p.voteCount,
      rank: i + 1,
    }));
}

export async function getMonthlyProducts(date: Date = new Date()) {
  const delistedSections = await getDelistedSections();
  const isDelisted = delistedSections.includes("monthly") || delistedSections.includes("all");

  const cycle = getMonthlyCycleRange(date);

  const whereCondition: any = {
    status: "LIVE",
    launchedAt: { gte: cycle.start, lt: cycle.end },
    ...(isDelisted ? GENUINE_PRODUCT_FILTER : {}),
  };

  let products = await prisma.product.findMany({
    where: whereCondition,
    include: {
      owner: { select: { username: true, name: true, image: true } },
      category: { select: { name: true, slug: true } },
      _count: {
        select: {
          votes: { where: { isFlagged: false } },
          comments: true,
        },
      },
      votes: { where: { isFlagged: false }, select: { userId: true } },
    },
    orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
  });

  if (!isDelisted && products.length < 15) {
    const seenIds = new Set(products.map((p) => p.id));
    const fillers = await prisma.product.findMany({
      where: { status: "LIVE", id: { notIn: Array.from(seenIds) } },
      take: 15 - products.length,
      include: {
        owner: { select: { username: true, name: true, image: true } },
        category: { select: { name: true, slug: true } },
        _count: {
          select: {
            votes: { where: { isFlagged: false } },
            comments: true,
          },
        },
        votes: { where: { isFlagged: false }, select: { userId: true } },
      },
      orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
    });
    products = [...products, ...fillers];
  }

  return products
    .map((p, i) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      logoUrl: p.logoUrl,
      websiteUrl: formatProductWebsiteUrl(p.websiteUrl),
      voteCount: p._count.votes || p.voteCount,
      commentCount: p._count.comments || p.commentCount,
      launchedAt: p.launchedAt,
      tags: p.tags,
      category: p.category?.name ?? "Tech",
      owner: p.owner,
      score: p._count.votes || p.voteCount,
      rank: i + 1,
    }));
}

export type FeedProductItem = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  websiteUrl: string;
  votes: number;
  voteCount: number;
  commentCount: number;
  launchedAt: string;
  tags: string[];
  category: string;
  owner: { username: string; name: string; image: string | null };
  maker: string;
  makerName: string;
  revenue: string;
  rank: number;
};

export type FeedResult = {
  products: FeedProductItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
};

const feedMemoryCache = new Map<string, { data: FeedResult; timestamp: number }>();
const FEED_CACHE_TTL_MS = 30_000; // 30s cache for lightning fast loads

export function invalidateFeedCache() {
  feedMemoryCache.clear();
}

export async function getFeedProducts({
  tab = "daily",
  page = 1,
  limit = 50,
  date = new Date(),
}: {
  tab?: TimeframeTab;
  page?: number;
  limit?: number;
  date?: Date;
}): Promise<FeedResult> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const delistedSections = await getDelistedSections();
  const isDelisted = delistedSections.includes(tab) || delistedSections.includes("all");

  const cacheKey = `${tab}_p${safePage}_l${safeLimit}_d${isDelisted}`;
  const cached = feedMemoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FEED_CACHE_TTL_MS) {
    return cached.data;
  }

  let whereClause: any = {
    status: "LIVE",
    ...(isDelisted ? GENUINE_PRODUCT_FILTER : {}),
  };

  if (tab === "daily") {
    const cycle = getDailyCycleRange(date);
    whereClause = {
      ...whereClause,
      launchedAt: { gte: cycle.start, lt: cycle.end },
    };
  } else if (tab === "weekly") {
    const cycle = getWeeklyCycleRange(date);
    whereClause = { ...whereClause, launchedAt: { gte: cycle.start, lt: cycle.end } };
  } else if (tab === "monthly") {
    const cycle = getMonthlyCycleRange(date);
    whereClause = { ...whereClause, launchedAt: { gte: cycle.start, lt: cycle.end } };
  } else if (tab === "yearly") {
    const cycle = getYearlyCycleRange(date);
    whereClause = { ...whereClause, launchedAt: { gte: cycle.start, lt: cycle.end } };
  }

  // Single-pass lean indexed query: fetch limit + 1 to determine hasMore without a separate table count scan
  let rows = await prisma.product.findMany({
    where: whereClause,
    skip,
    take: safeLimit + 1,
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      logoUrl: true,
      websiteUrl: true,
      voteCount: true,
      commentCount: true,
      launchedAt: true,
      tags: true,
      owner: { select: { username: true, name: true, image: true } },
      category: { select: { name: true, slug: true } },
      revenue: { select: { isVerified: true, mrrCents: true } },
    },
    orderBy: [
      { voteCount: "desc" },
      { launchedAt: "desc" },
    ],
  });

  // Fallback for daily/weekly if empty
  if (rows.length === 0 && (tab === "daily" || tab === "weekly") && !isDelisted && !delistedSections.includes("filler")) {
    rows = await prisma.product.findMany({
      where: { status: "LIVE" },
      skip,
      take: safeLimit + 1,
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        logoUrl: true,
        websiteUrl: true,
        voteCount: true,
        commentCount: true,
        launchedAt: true,
        tags: true,
        owner: { select: { username: true, name: true, image: true } },
        category: { select: { name: true, slug: true } },
        revenue: { select: { isVerified: true, mrrCents: true } },
      },
      orderBy: [
        { voteCount: "desc" },
        { launchedAt: "desc" },
      ],
    });
  }

  const hasMore = rows.length > safeLimit;
  const pagedRows = hasMore ? rows.slice(0, safeLimit) : rows;

  const products: FeedProductItem[] = pagedRows.map((p, i) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    logoUrl: p.logoUrl,
    websiteUrl: formatProductWebsiteUrl(p.websiteUrl),
    votes: p.voteCount,
    voteCount: p.voteCount,
    commentCount: p.commentCount,
    launchedAt: new Date(p.launchedAt).toISOString().slice(0, 10),
    tags: p.tags,
    category: p.category?.name || "Tech",
    owner: p.owner,
    maker: `@${p.owner.username}`,
    makerName: p.owner.name || p.owner.username,
    revenue: p.revenue?.isVerified && p.revenue.mrrCents > 0
      ? `$${(p.revenue.mrrCents / 100).toFixed(p.revenue.mrrCents % 100 === 0 ? 0 : 2)} MRR`
      : "",
    rank: skip + i + 1,
  }));

  const totalCount = skip + pagedRows.length + (hasMore ? 1 : 0);

  const result: FeedResult = {
    products,
    totalCount,
    page: safePage,
    limit: safeLimit,
    totalPages: hasMore ? safePage + 1 : safePage,
    hasMore,
  };

  feedMemoryCache.set(cacheKey, { data: result, timestamp: Date.now() });

  return result;
}

const productBySlugCache = new Map<string, { data: any; timestamp: number }>();
const PRODUCT_SLUG_CACHE_TTL_MS = 60_000; // 60s cache

export const getProductBySlug = cache(async function getProductBySlug(slug: string) {
  const normSlug = slug.toLowerCase().trim();
  const cached = productBySlugCache.get(normSlug);
  if (cached && Date.now() - cached.timestamp < PRODUCT_SLUG_CACHE_TTL_MS) {
    return cached.data;
  }

  const p = await prisma.product.findUnique({
    where: { slug: normSlug },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          image: true,
          bio: true,
          title: true,
          websiteUrl: true,
          twitterHandle: true,
          githubHandle: true,
          isProfilePublic: true,
        },
      },
      category: true,
      revenue: {
        include: {
          connection: {
            select: {
              provider: true,
            },
          },
        },
      },
      makers: {
        include: {
          user: {
            select: { username: true, name: true, image: true },
          },
        },
      },
    },
  });

  if (!p || p.status !== "LIVE") return null;
  const result = {
    ...p,
    websiteUrl: formatProductWebsiteUrl(p.websiteUrl),
  };
  productBySlugCache.set(normSlug, { data: result, timestamp: Date.now() });
  return result;
});

const similarProductsCache = new Map<string, { data: any[]; timestamp: number }>();
const SIMILAR_CACHE_TTL_MS = 60_000;

export async function getSimilarProducts(categoryId?: string | null, excludeProductId?: string) {
  const cacheKey = `${categoryId || "all"}_ex_${excludeProductId || ""}`;
  const cached = similarProductsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SIMILAR_CACHE_TTL_MS) {
    return cached.data;
  }

  let rawSimilar = await prisma.product.findMany({
    where: {
      status: "LIVE",
      ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      logoUrl: true,
      voteCount: true,
      category: { select: { name: true } },
      owner: { select: { name: true, username: true } },
      revenue: { select: { isVerified: true, mrrCents: true } },
    },
    orderBy: { voteCount: "desc" },
    take: 10,
  });

  if (rawSimilar.length < 4) {
    const existingIds = excludeProductId ? [excludeProductId, ...rawSimilar.map((s) => s.id)] : rawSimilar.map((s) => s.id);
    const additional = await prisma.product.findMany({
      where: {
        status: "LIVE",
        id: { notIn: existingIds },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        logoUrl: true,
        voteCount: true,
        category: { select: { name: true } },
        owner: { select: { name: true, username: true } },
        revenue: { select: { isVerified: true, mrrCents: true } },
      },
      orderBy: { voteCount: "desc" },
      take: 10 - rawSimilar.length,
    });
    rawSimilar = [...rawSimilar, ...additional];
  }

  const mapped = rawSimilar.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    logoUrl: s.logoUrl,
    voteCount: s.voteCount,
    categoryName: s.category?.name || "General",
    maker: s.owner?.username ? `@${s.owner.username}` : undefined,
    mrr:
      s.revenue?.isVerified && s.revenue.mrrCents > 0
        ? s.revenue.mrrCents >= 100000
          ? `$${(s.revenue.mrrCents / 100000).toFixed(1)}K/mo`
          : `$${(s.revenue.mrrCents / 100).toFixed(0)}/mo`
        : null,
  }));

  similarProductsCache.set(cacheKey, { data: mapped, timestamp: Date.now() });
  return mapped;
}
