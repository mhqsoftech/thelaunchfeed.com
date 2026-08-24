import { prisma } from "@/lib/db";
import type { ProductAward } from "@/lib/awards";

const UPVOTE_AWARD_THRESHOLD = 50;

/**
 * Computes all eligible awards for a batch of products based on live ranks,
 * historical RankSnapshot awards, verified telemetry, and all-time standings.
 * (Server-only query function)
 */
export async function computeAwardsForProducts(
  products: Array<{
    id: string;
    slug?: string;
    voteCount: number;
    dailyRank?: number | null;
    weeklyRank?: number | null;
    monthlyRank?: number | null;
    revenue?: { isVerified?: boolean; mrrCents?: number } | null;
  }>
): Promise<Map<string, ProductAward[]>> {
  const result = new Map<string, ProductAward[]>();
  if (products.length === 0) return result;

  const productIds = products.map((p) => p.id);

  const [snapshots, revenues, allTimeTop3, yearlyTop3] = await Promise.all([
    prisma.rankSnapshot.findMany({
      where: { productId: { in: productIds }, rank: { in: [1, 2, 3] } },
      select: { productId: true, period: true, rank: true },
    }).catch(() => []),
    prisma.productRevenue.findMany({
      where: { productId: { in: productIds }, isVerified: true },
      select: { productId: true },
    }).catch(() => []),
    prisma.product.findMany({
      where: { status: "LIVE" },
      orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
      take: 3,
      select: { id: true },
    }).catch(() => []),
    prisma.product.findMany({
      where: {
        status: "LIVE",
        launchedAt: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1, 0, 30, 0, 0)) },
      },
      orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
      take: 3,
      select: { id: true },
    }).catch(() => []),
  ]);

  const revSet = new Set(revenues.map((r) => r.productId));
  const allTimeIds = allTimeTop3.map((p) => p.id);
  const yearlyIds = yearlyTop3.map((p) => p.id);

  // Group snapshots by product
  const snapMap = new Map<string, Array<{ period: string; rank: number }>>();
  for (const s of snapshots) {
    const list = snapMap.get(s.productId) || [];
    list.push({ period: s.period, rank: s.rank });
    snapMap.set(s.productId, list);
  }

  for (const p of products) {
    const list: ProductAward[] = ["launch"];
    const snaps = snapMap.get(p.id) || [];

    // 1. Daily Ranks (Historical snapshots + active live rank)
    const hasDaily1 = snaps.some((s) => s.period === "DAILY" && s.rank === 1) || p.dailyRank === 1;
    const hasDaily2 = snaps.some((s) => s.period === "DAILY" && s.rank === 2) || p.dailyRank === 2;
    const hasDaily3 = snaps.some((s) => s.period === "DAILY" && s.rank === 3) || p.dailyRank === 3;
    if (hasDaily1) {
      list.push("daily_1");
      list.push("pod");
    }
    if (hasDaily2) list.push("daily_2");
    if (hasDaily3) list.push("daily_3");

    // 2. Weekly Ranks
    const hasWeekly1 = snaps.some((s) => s.period === "WEEKLY" && s.rank === 1) || p.weeklyRank === 1;
    const hasWeekly2 = snaps.some((s) => s.period === "WEEKLY" && s.rank === 2) || p.weeklyRank === 2;
    const hasWeekly3 = snaps.some((s) => s.period === "WEEKLY" && s.rank === 3) || p.weeklyRank === 3;
    if (hasWeekly1) list.push("weekly_1");
    if (hasWeekly2) list.push("weekly_2");
    if (hasWeekly3) list.push("weekly_3");

    // 3. Monthly Ranks
    const hasMonthly1 = snaps.some((s) => s.period === "MONTHLY" && s.rank === 1) || p.monthlyRank === 1;
    const hasMonthly2 = snaps.some((s) => s.period === "MONTHLY" && s.rank === 2) || p.monthlyRank === 2;
    const hasMonthly3 = snaps.some((s) => s.period === "MONTHLY" && s.rank === 3) || p.monthlyRank === 3;
    if (hasMonthly1) list.push("monthly_1");
    if (hasMonthly2) list.push("monthly_2");
    if (hasMonthly3) list.push("monthly_3");

    // 4. Yearly Ranks
    const yIdx = yearlyIds.indexOf(p.id);
    if (yIdx === 0) {
      list.push("yearly_1");
      list.push("champion");
    } else if (yIdx === 1) {
      list.push("yearly_2");
    } else if (yIdx === 2) {
      list.push("yearly_3");
    }

    // 5. All-Time Ranks
    const atIdx = allTimeIds.indexOf(p.id);
    if (atIdx === 0) list.push("alltime_1");
    else if (atIdx === 1) list.push("alltime_2");
    else if (atIdx === 2) list.push("alltime_3");

    // 6. Revenue & Upvotes
    if (revSet.has(p.id) || p.revenue?.isVerified) list.push("revenue");
    if (p.voteCount >= UPVOTE_AWARD_THRESHOLD) list.push("upvote");

    result.set(p.id, Array.from(new Set(list)));
  }

  return result;
}

/**
 * Computes all eligible awards for a single product (server-only).
 */
export async function computeAwardsForProduct(product: {
  id: string;
  slug?: string;
  voteCount: number;
  dailyRank?: number | null;
  weeklyRank?: number | null;
  monthlyRank?: number | null;
  revenue?: { isVerified?: boolean; mrrCents?: number } | null;
}): Promise<ProductAward[]> {
  const map = await computeAwardsForProducts([product]);
  return map.get(product.id) || ["launch"];
}

// Minimum elapsed milliseconds since launch before a category's badges are revealed
const TIME_GATE_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000, // 24 hours
  weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
  monthly: 30 * 24 * 60 * 60 * 1000, // 30 days
  yearly: 365 * 24 * 60 * 60 * 1000, // 365 days
  alltime: 365 * 24 * 60 * 60 * 1000, // 365 days
};

// Maps award IDs to their time-gate category
function getAwardTimeGateCategory(award: string): string | null {
  if (award.startsWith("daily_")) return "daily";
  if (award.startsWith("weekly_")) return "weekly";
  if (award.startsWith("monthly_")) return "monthly";
  if (award.startsWith("yearly_") || award === "champion") return "yearly";
  if (award.startsWith("alltime_")) return "alltime";
  // pod is an alias for daily_1
  if (award === "pod") return "daily";
  return null;
}

/**
 * Computes time-gated eligible awards for a single product.
 * Rank badges (daily/weekly/monthly/yearly/alltime) are only included
 * if the required time period has elapsed since the product's launch date.
 * Non-rank awards (launch, revenue, upvote) are always included.
 */
export async function computeAwardsForProductTimegated(product: {
  id: string;
  slug?: string;
  voteCount: number;
  dailyRank?: number | null;
  weeklyRank?: number | null;
  monthlyRank?: number | null;
  revenue?: { isVerified?: boolean; mrrCents?: number } | null;
  launchedAt: Date;
}): Promise<ProductAward[]> {
  const allAwards = await computeAwardsForProduct(product);
  const elapsed = Date.now() - product.launchedAt.getTime();

  return allAwards.filter((award) => {
    const category = getAwardTimeGateCategory(award);
    if (!category) return true; // non-rank awards pass through
    const requiredMs = TIME_GATE_MS[category];
    return requiredMs ? elapsed >= requiredMs : true;
  });
}

/**
 * Checks whether a specific award is time-gate eligible for a given launch date.
 * Used by the badge SVG API to enforce time-gating at the render layer.
 */
export function isAwardTimegateEligible(award: string, launchedAt: Date): boolean {
  const category = getAwardTimeGateCategory(award);
  if (!category) return true;
  const requiredMs = TIME_GATE_MS[category];
  if (!requiredMs) return true;
  return Date.now() - launchedAt.getTime() >= requiredMs;
}
