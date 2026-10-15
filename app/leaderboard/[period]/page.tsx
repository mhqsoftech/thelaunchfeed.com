import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeFeedClient, { type FeedTab } from "@/components/home/HomeFeedClient";
import { loadBoard, boardJsonLd } from "@/lib/queries/board";
import { SITE_URL } from "@/lib/seo/schema";

export const dynamic = "force-dynamic";

const year = () => new Date().getFullYear();

const BOARDS: Record<string, { tab: FeedTab; title: () => string; description: () => string; crumb: string }> = {
  weekly: {
    tab: "weekly",
    crumb: "This week",
    title: () => "Best New Software & AI Products This Week",
    description: () =>
      "The week's highest-voted new software, SaaS and AI tools, grouped by category and ranked by the maker community on The Launch Feed.",
  },
  monthly: {
    tab: "monthly",
    crumb: "This month",
    title: () => `Best New Products of ${new Date().toLocaleString("en-US", { month: "long" })} ${year()}`,
    description: () =>
      "This month's top product launches — new SaaS, developer tools and AI apps ranked by real upvotes, grouped by category.",
  },
  yearly: {
    tab: "yearly",
    crumb: String(year()),
    title: () => `Best Software & AI Products of ${year()}`,
    description: () =>
      `The ${year()} champions: the most upvoted software, SaaS and AI products launched on The Launch Feed this year.`,
  },
  "all-time": {
    tab: "alltime",
    crumb: "All time",
    title: () => "All-Time Top Products — Hall of Fame",
    description: () =>
      "The most upvoted products ever launched on The Launch Feed — the all-time hall of fame for indie, SaaS and AI software.",
  },
};

export function generateStaticParams() {
  return Object.keys(BOARDS).map((period) => ({ period }));
}

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }): Promise<Metadata> {
  const { period } = await params;
  const board = BOARDS[period];
  if (!board) return {};
  const title = `${board.title()} | The Launch Feed`;
  return {
    title,
    description: board.description(),
    alternates: { canonical: `/leaderboard/${period}` },
    openGraph: {
      title,
      description: board.description(),
      url: `${SITE_URL}/leaderboard/${period}`,
      type: "website",
      images: [{ url: "/thelaunchfeed-og.avif", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description: board.description() },
  };
}

export default async function LeaderboardPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  const board = BOARDS[period];
  if (!board) notFound();

  const { initialFeed, initialCategories, liveTopProducts } = await loadBoard(board.tab);
  const jsonLd = boardJsonLd({
    path: `/leaderboard/${period}`,
    name: board.title(),
    description: board.description(),
    products: initialFeed?.products ?? [],
    trail: [
      { name: "The Launch Feed", url: SITE_URL },
      { name: "Leaderboards", url: `${SITE_URL}/leaderboard/weekly` },
      { name: board.crumb, url: `${SITE_URL}/leaderboard/${period}` },
    ],
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeFeedClient
        initialFeed={initialFeed}
        initialTab={board.tab}
        initialCategories={initialCategories}
        liveTopProducts={liveTopProducts}
        showEditorial={false}
      />
    </>
  );
}
