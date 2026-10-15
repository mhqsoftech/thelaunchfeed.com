import { prisma } from "@/lib/db";
import { getFeedProducts } from "@/lib/queries/products";
import { getCategoriesWithCounts } from "@/lib/queries/categories";
import { SITE_URL, WEBSITE_ID, breadcrumb } from "@/lib/seo/schema";
import type { HomeFeedInitialData, FeedTab } from "@/components/home/HomeFeedClient";
import type { LiveTopProductItem } from "@/components/home/HomeEditorialSection";

/** Server-side preload shared by the home page and /leaderboard/[period]. */
export async function loadBoard(tab: FeedTab) {
  let initialFeed: HomeFeedInitialData | undefined;
  let initialCategories: { id?: string; slug: string; name: string; productCount: number }[] = [];
  let liveTopProducts: LiveTopProductItem[] = [];

  try {
    const [feed, cats, topProducts] = await Promise.all([
      getFeedProducts({ tab, page: 1, limit: 50 }),
      getCategoriesWithCounts().catch(() => []),
      prisma.product
        .findMany({
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
        })
        .catch(() => []),
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
    console.error(`Failed to preload ${tab} board on server:`, err);
  }

  return { initialFeed, initialCategories, liveTopProducts };
}

/** CollectionPage + ItemList (+ breadcrumbs) for a leaderboard URL. */
export function boardJsonLd(opts: {
  path: string;
  name: string;
  description: string;
  products: Array<{ name: string; slug: string; tagline?: string }>;
  trail?: Array<{ name: string; url: string }>;
}) {
  const url = `${SITE_URL}${opts.path === "/" ? "" : opts.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: opts.name,
        description: opts.description,
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: { "@id": `${url}#list` },
        dateModified: new Date().toISOString(),
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: opts.name,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: Math.min(opts.products.length, 20),
        itemListElement: opts.products.slice(0, 20).map((p, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: `${SITE_URL}/product/${p.slug}`,
          name: p.name,
        })),
      },
      ...(opts.trail ? [breadcrumb(opts.trail)] : []),
    ],
  };
}
