import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProductBySlug } from "@/lib/queries/products";
import { computeAwardsForProduct } from "@/lib/queries/awards";
import BadgesClientView from "../BadgesClientView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  const name = product?.name || slug;
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
  const canonicalUrl = `${siteUrl}/badges/${encodeURIComponent(slug)}`;
  const description = `Official embeddable award badges, leaderboard rankings, and vector SVG trophies for ${name} on The Launch Feed.`;

  return {
    title: `${name} Official Badges & Trophies - The Launch Feed`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      title: `${name} Official Badges & Trophies - The Launch Feed`,
      description,
      siteName: "The Launch Feed",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} Official Badges & Trophies - The Launch Feed`,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function ProductBadgesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sParams = await searchParams;
  const cleanSlug = decodeURIComponent(slug).trim();
  const requestedAward = (typeof sParams.award === "string" ? sParams.award : "").toLowerCase();
  const download = sParams.download === "true" || sParams.download === "1";

  if (download && requestedAward) {
    redirect(`/api/badge/${encodeURIComponent(cleanSlug)}?award=${encodeURIComponent(requestedAward)}&download=true`);
  }

  const product = await getProductBySlug(cleanSlug);
  if (!product) notFound();

  // Compute all awards this specific product has earned / is eligible for
  const eligibleAwards = await computeAwardsForProduct(product);

  const initialAward =
    requestedAward && (eligibleAwards.includes(requestedAward as any) || (requestedAward === "daily_1" && eligibleAwards.includes("pod" as any)))
      ? requestedAward
      : eligibleAwards.find((a) => a !== "launch" && a !== "pod") || eligibleAwards[0] || "launch";

  return (
    <BadgesClientView
      initialProduct={product.slug}
      productName={product.name}
      initialAward={initialAward}
      eligibleAwardIds={eligibleAwards}
      isProductSpecific={true}
    />
  );
}
