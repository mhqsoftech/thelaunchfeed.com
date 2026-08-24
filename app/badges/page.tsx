import type { Metadata } from "next";
import BadgesClientView from "./BadgesClientView";
import { organizationNode, websiteNode, breadcrumb } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "Official Embed Badges & Trophies - The Launch Feed",
  description:
    "Explore official vector SVG badges and trophies for The Launch Feed. Badges are prestigious awards earned by top-performing products on the leaderboard.",
};

export default async function BadgesPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BadgesClientView />
    </>
  );
}
