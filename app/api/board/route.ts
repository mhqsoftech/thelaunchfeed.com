import { NextRequest, NextResponse } from "next/server";
import {
  getDailyProducts,
  getWeeklyProducts,
  getMonthlyProducts,
  getFeedProducts,
  type TimeframeTab,
} from "@/lib/queries/products";

export const dynamic = "force-dynamic";

export type BoardRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  votes: number;
  voteCount: number;
  maker: string;
  makerName: string;
  category: string;
  logoUrl?: string | null;
  launchedAt?: string;
  revenue?: string;
  rank?: number;
};

function shape(p: any): BoardRow {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    votes: p.voteCount ?? p.votes ?? 0,
    voteCount: p.voteCount ?? p.votes ?? 0,
    maker: p.maker || (p.owner?.username ? `@${p.owner.username}` : "@maker"),
    makerName: p.makerName || p.owner?.name || p.owner?.username || "Maker",
    category: p.category || "Tech",
    logoUrl: p.logoUrl || null,
    launchedAt: p.launchedAt ? new Date(p.launchedAt).toISOString().slice(0, 10) : undefined,
    revenue: p.revenue || "",
    rank: p.rank,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") as TimeframeTab | null;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  // If a specific tab is requested, return paginated results for that tab
  if (tab && ["daily", "weekly", "monthly", "yearly", "alltime"].includes(tab)) {
    const feed = await getFeedProducts({ tab, page, limit });
    return NextResponse.json(
      {
        products: feed.products.map(shape),
        totalCount: feed.totalCount,
        page: feed.page,
        limit: feed.limit,
        totalPages: feed.totalPages,
        hasMore: feed.hasMore,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  }

  // Otherwise, return top lists for initial board hydration
  const [daily, weekly, monthly, yearly, alltime] = await Promise.all([
    getFeedProducts({ tab: "daily", page: 1, limit: 50 }),
    getFeedProducts({ tab: "weekly", page: 1, limit: 50 }),
    getFeedProducts({ tab: "monthly", page: 1, limit: 50 }),
    getFeedProducts({ tab: "yearly", page: 1, limit: 50 }),
    getFeedProducts({ tab: "alltime", page: 1, limit: 50 }),
  ]);

  return NextResponse.json(
    {
      daily: daily.products.map(shape),
      weekly: weekly.products.map(shape),
      monthly: monthly.products.map(shape),
      yearly: yearly.products.map(shape),
      alltime: alltime.products.map(shape),
      counts: {
        daily: daily.totalCount,
        weekly: weekly.totalCount,
        monthly: monthly.totalCount,
        yearly: yearly.totalCount,
        alltime: alltime.totalCount,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    }
  );
}
