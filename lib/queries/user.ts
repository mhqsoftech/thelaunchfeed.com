import { cache } from "react";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export function publicUserSelect() {
  // Select fields exposed on public founder profile page including title
  return {
    id: true,
    username: true,
    name: true,
    title: true,
    image: true,
    bio: true,
    isProfilePublic: true,
    showRevenuePublic: true,
    websiteUrl: true,
    twitterHandle: true,
    githubHandle: true,
    createdAt: true,
  } satisfies Prisma.UserSelect;
}

const publicProfileCache = new Map<string, { data: any; timestamp: number }>();
const PROFILE_CACHE_TTL_MS = 60_000; // 60s

export function invalidateProfileCache() {
  publicProfileCache.clear();
}

export const getPublicProfile = cache(async function getPublicProfile(rawSlug: string, viewerId?: string) {
  if (!rawSlug) return null;
  const clean = rawSlug.replace(/^@/, "").trim().toLowerCase();
  const noDash = clean.replace(/-/g, "");
  const withUnderscore = clean.replace(/-/g, "_");
  const withDash = clean.replace(/_/g, "-");

  const cacheKey = `${clean}_v_${viewerId || ""}`;
  const cached = publicProfileCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL_MS) {
    return cached.data;
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: clean, mode: "insensitive" } },
        { username: { equals: noDash, mode: "insensitive" } },
        { username: { equals: withUnderscore, mode: "insensitive" } },
        { username: { equals: withDash, mode: "insensitive" } },
        { id: clean },
        { email: { startsWith: clean, mode: "insensitive" } },
        { name: { equals: clean.replace(/[-_]/g, " "), mode: "insensitive" } },
      ],
    },
    select: {
      ...publicUserSelect(),
      revenueConnections: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: {
          revenues: true,
        },
      },
      products: {
        where: { status: "LIVE" },
        orderBy: { launchedAt: "desc" },
        select: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          logoUrl: true,
          websiteUrl: true,
          tags: true,
          commentCount: true,
          voteCount: true,
          launchedAt: true,
          revenue: true,
          category: { select: { slug: true, name: true } },
        },
      },
    },
  });

  if (!user) return null;
  if (!user.isProfilePublic && user.id !== viewerId) return null;

  publicProfileCache.set(cacheKey, { data: user, timestamp: Date.now() });
  return user;
});

export interface SuggestedFounder {
  id: string;
  username: string;
  name: string | null;
  title: string | null;
  image: string | null;
  bio: string | null;
  twitterHandle: string | null;
  githubHandle: string | null;
  productsCount: number;
  featuredProductName?: string;
  featuredProductCategory?: string;
}

const suggestedFoundersCache = new Map<string, { data: SuggestedFounder[]; timestamp: number }>();
const SUGGESTED_FOUNDERS_CACHE_TTL_MS = 60_000;

export const getSuggestedFounders = cache(async function getSuggestedFounders(excludeUsername?: string, limit = 12): Promise<SuggestedFounder[]> {
  const cacheKey = `${excludeUsername || ""}_l_${limit}`;
  const cached = suggestedFoundersCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SUGGESTED_FOUNDERS_CACHE_TTL_MS) {
    return cached.data;
  }

  const users = await prisma.user.findMany({
    where: {
      isProfilePublic: true,
      username: excludeUsername ? { not: excludeUsername } : undefined,
      products: { some: { status: "LIVE" } },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      name: true,
      title: true,
      image: true,
      bio: true,
      twitterHandle: true,
      githubHandle: true,
      products: {
        where: { status: "LIVE" },
        take: 1,
        orderBy: { voteCount: "desc" },
        select: {
          name: true,
          category: { select: { name: true } },
        },
      },
      _count: {
        select: { products: { where: { status: "LIVE" } } },
      },
    },
  });

  const result = users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    title: u.title,
    image: u.image,
    bio: u.bio,
    twitterHandle: u.twitterHandle,
    githubHandle: u.githubHandle,
    productsCount: u._count.products,
    featuredProductName: u.products[0]?.name,
    featuredProductCategory: u.products[0]?.category?.name,
  }));

  suggestedFoundersCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
});
