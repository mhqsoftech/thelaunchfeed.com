import type { Metadata } from "next";
import MainLayoutShell from "@/app/MainLayoutShell";
import BadgesClientView from "./BadgesClientView";
import { breadcrumb, webPageNode } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "Official Embed Badges & Trophies - The Launch Feed",
  description:
    "Explore official vector SVG badges and trophies for The Launch Feed. Badges are prestigious awards earned by top-performing products on the leaderboard.",
  alternates: { canonical: "/badges" },
};

export default async function BadgesPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      webPageNode({ path: "/badges", name: "Launch badges & trophies", description: metadata.description ?? undefined, type: "CollectionPage" }),
      {
        ...breadcrumb([
          { name: "Home", url: siteUrl },
          { name: "Official Embed Badges", url: `${siteUrl}/badges` },
        ]),
        "@id": `${siteUrl}/badges#breadcrumb`,
      },
    ],
  };

  return (
    <MainLayoutShell rails={false}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BadgesClientView />
    </MainLayoutShell>
  );
}
