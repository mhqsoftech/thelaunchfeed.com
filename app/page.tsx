import type { Metadata } from "next";
import HomeFeedClient from "@/components/home/HomeFeedClient";
import { loadBoard, boardJsonLd } from "@/lib/queries/board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const legacy = params.tab === "alltime" ? "alltime" : params.tab;
  const tab = legacy && ["daily", "weekly", "monthly", "yearly", "alltime"].includes(legacy)
    ? (legacy as "daily" | "weekly" | "monthly" | "yearly" | "alltime")
    : "daily";

  const { initialFeed, initialCategories, liveTopProducts } = await loadBoard(tab);

  const jsonLd = boardJsonLd({
    path: "/",
    name: "Today's top software & AI product launches",
    description:
      "Live daily leaderboard of new software, SaaS and AI products, ranked by community upvotes on The Launch Feed.",
    products: initialFeed?.products ?? [],
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeFeedClient
        initialFeed={initialFeed}
        initialTab={tab}
        initialCategories={initialCategories}
        liveTopProducts={liveTopProducts}
      />
    </>
  );
}
