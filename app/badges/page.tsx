import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BadgesClientView from "./BadgesClientView";

export const metadata: Metadata = {
  title: "Official Embed Badges & Trophies - The Launch Feed",
  description:
    "Explore, customize, and download official vector SVG badges for The Launch Feed. Embed live leaderboard ranking, Product of the Day, and verified MRR badges.",
};

export default async function BadgesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const product = (typeof params.product === "string" ? params.product : typeof params.slug === "string" ? params.slug : "")?.trim();
  const award = (typeof params.award === "string" ? params.award : "launch").toLowerCase();
  const download = params.download === "true" || params.download === "1";

  // If a specific product download was requested directly via /badges?product=xyz&download=true
  if (product && download) {
    redirect(`/api/badge/${encodeURIComponent(product)}?award=${encodeURIComponent(award)}&download=true`);
  }

  return <BadgesClientView initialProduct={product} initialAward={award} />;
}
