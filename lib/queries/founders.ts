import { cache } from "react";
import { prisma } from "@/lib/db";
import { getFounderScore, type FounderLevelBase } from "@/lib/founder-score";

export type TopFounderItem = {
  rank: number;
  id: string;
  username: string;
  name: string;
  title: string | null;
  image: string | null;
  bio: string | null;
  websiteUrl: string | null;
  twitterHandle: string | null;
  githubHandle: string | null;
  createdAt: string;
  points: number;
  level: FounderLevelBase;
  productsCount: number;
  totalVotes: number;
  topProducts: Array<{
    name: string;
    slug: string;
    logoUrl: string | null;
    voteCount: number;
  }>;
};

const foundersCache = new Map<number, { data: TopFounderItem[]; timestamp: number }>();
const FOUNDERS_CACHE_TTL_MS = 60_000; // 60s

export function invalidateFoundersCache() {
  foundersCache.clear();
}

export const getTopFounders = cache(async function getTopFounders(limit: number = 100): Promise<TopFounderItem[]> {
  const cached = foundersCache.get(limit);
  if (cached && Date.now() - cached.timestamp < FOUNDERS_CACHE_TTL_MS) {
    return cached.data;
  }

  const users = await prisma.user.findMany({
    where: {
      isProfilePublic: true,
      OR: [
        { products: { some: { status: "LIVE" } } },
        { title: { not: null } },
        { bio: { not: null } },
      ],
    },
    take: Math.min(250, Math.max(50, limit * 2)),
    select: {
      id: true,
      username: true,
      name: true,
      title: true,
      image: true,
      bio: true,
      websiteUrl: true,
      twitterHandle: true,
      githubHandle: true,
      createdAt: true,
      products: {
        where: { status: "LIVE" },
        orderBy: { voteCount: "desc" },
        take: 3,
        select: {
          name: true,
          slug: true,
          logoUrl: true,
          voteCount: true,
        },
      },
      _count: { select: { votes: true } },
    },
  });

  // Calculate scores for all users
  const scoredFounders = users.map((u) => {
    const productsCount = u.products.length;
    const totalVotes = u.products.reduce((acc, p) => acc + p.voteCount, 0);
    const votesGiven = (u as any)._count?.votes ?? 0;
    const scoreInfo = getFounderScore(
      productsCount,
      totalVotes,
      u.createdAt ? u.createdAt.toISOString() : undefined,
      votesGiven
    );

    return {
      id: u.id,
      username: u.username || u.name.toLowerCase().replace(/\s+/g, ""),
      name: u.name || u.username,
      title: u.title,
      image: u.image,
      bio: u.bio,
      websiteUrl: u.websiteUrl,
      twitterHandle: u.twitterHandle,
      githubHandle: u.githubHandle,
      createdAt: u.createdAt.toISOString(),
      points: scoreInfo.points,
      level: scoreInfo.currentLevel,
      productsCount,
      totalVotes,
      topProducts: u.products.slice(0, 3),
    };
  });

  // Sort descending by points, then totalVotes, then productsCount
  scoredFounders.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
    return b.productsCount - a.productsCount;
  });

  // Slice to limit and attach rank 1..N
  const result = scoredFounders.slice(0, limit).map((f, idx) => ({
    ...f,
    rank: idx + 1,
  }));

  foundersCache.set(limit, { data: result, timestamp: Date.now() });
  return result;
});
