import type { Metadata } from "next";
import MainLayoutShell from "@/app/MainLayoutShell";
import BadgesClientView from "./BadgesClientView";
import { breadcrumb, webPageNode } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "Product Launch Badges and Winner Awards | The Launch Feed",
  description:
    "Embeddable launch badges for your website or GitHub README. The top three products of each day, week, month and year on The Launch Feed earn winner badges.",
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
