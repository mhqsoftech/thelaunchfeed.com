import type { Metadata } from "next";
import { getTopFounders } from "@/lib/queries/founders";
import FoundersClientView from "./FoundersClientView";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Top 100 Founders - The Launch Feed",
  description:
    "Explore the top 100 software founders, creators, and indie builders ranked dynamically by products launched, cumulative votes, and craft prestige.",
  alternates: {
    canonical: `${siteUrl}/founders`,
  },
  openGraph: {
    title: "Top 100 Founders - The Launch Feed",
    description:
      "Explore the top 100 software founders, creators, and indie builders ranked dynamically by products launched, cumulative votes, and craft prestige.",
    type: "website",
    url: `${siteUrl}/founders`,
    siteName: "The Launch Feed",
    images: [
      {
        url: `${siteUrl}/icon.svg`,
        width: 1200,
        height: 630,
        alt: "Top 100 Founders - The Launch Feed",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Top 100 Founders - The Launch Feed",
    description:
      "Explore the top 100 software founders, creators, and indie builders ranked dynamically by products launched, cumulative votes, and craft prestige.",
    images: [`${siteUrl}/icon.svg`],
    creator: "@thelaunchfeed",
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

export default async function TopFoundersPage() {
  const founders = await getTopFounders(100);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/founders`,
        name: "Top 100 Founders & Software Makers",
        description:
          "Directory of the top 100 software founders, creators, and builders on The Launch Feed.",
        url: `${siteUrl}/founders`,
        mainEntity: {
          "@type": "ItemList",
          itemListElement: founders.slice(0, 50).map((f, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            name: f.name || f.username,
            url: `${siteUrl}/founder/${f.username}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Founders Leaderboard",
            item: `${siteUrl}/founders`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FoundersClientView founders={founders} />
    </>
  );
}
