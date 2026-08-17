import { getFeedProducts } from "@/lib/queries/products";
import { getCategoriesWithCounts } from "@/lib/queries/categories";
import { prisma } from "@/lib/db";
import HomeFeedClient, { type HomeFeedInitialData } from "@/components/home/HomeFeedClient";
import type { LiveTopProductItem } from "@/components/home/HomeEditorialSection";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedTab = params.tab as "daily" | "weekly" | "monthly" | "yearly" | "alltime" | undefined;
  const validTab = requestedTab && ["daily", "weekly", "monthly", "yearly", "alltime"].includes(requestedTab)
    ? requestedTab
    : "daily";

  let initialFeed: HomeFeedInitialData | undefined = undefined;
  let initialCategories: { id?: string; slug: string; name: string; productCount: number }[] = [];
  let liveTopProducts: LiveTopProductItem[] = [];

  try {
    const [feed, cats, topProducts] = await Promise.all([
      getFeedProducts({ tab: validTab, page: 1, limit: 50 }),
      getCategoriesWithCounts().catch(() => []),
      prisma.product.findMany({
        where: { status: "LIVE" },
        orderBy: { voteCount: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          tagline: true,
          slug: true,
          voteCount: true,
          owner: { select: { username: true, name: true } },
          category: { select: { name: true } },
          revenue: { select: { mrrCents: true, isVerified: true } },
        },
      }).catch(() => []),
    ]);

    initialFeed = {
      products: feed.products.map((p) => ({
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
      })),
      totalCount: feed.totalCount,
      totalPages: feed.totalPages,
    };
    initialCategories = cats;
    liveTopProducts = topProducts;
  } catch (err) {
    console.error("Failed to preload initial feed on server:", err);
  }

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "The Launch Feed",
        url: siteUrl,
        description:
          "The daily software and AI product leaderboard with 360-degree technical architecture intelligence, founder manifestos, and verified revenue transparency.",
        publisher: {
          "@type": "Organization",
          name: "The Launch Feed",
          url: siteUrl,
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/icon.svg`,
          },
        },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "ItemList",
        "@id": `${siteUrl}/#daily-leaderboard`,
        name: "Today's Top Software Launches",
        itemListElement: (initialFeed?.products || []).slice(0, 10).map((p, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          name: p.name,
          url: `${siteUrl}/product/${p.slug}`,
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeFeedClient
        initialFeed={initialFeed}
        initialTab={validTab}
        initialCategories={initialCategories}
        liveTopProducts={liveTopProducts}
      />
    </>
  );
}
