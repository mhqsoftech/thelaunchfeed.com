import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/queries/user";
import { buildFounderViewWithSuggested } from "@/lib/queries/founderView";
import FounderClientView from "./FounderClientView";
import { organizationNode, websiteNode, breadcrumb, ORG_ID, WEBSITE_ID, SITE_NAME } from "@/lib/seo/schema";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).trim();
  const founder = await getPublicProfile(cleanSlug);
  if (!founder) {
    return {
      title: "Founder Not Found - The Launch Feed",
      robots: { index: false, follow: false },
    };
  }

  const name = founder.name || founder.username;
  const handle = `@${founder.username}`;
  const title = founder.title ? `${founder.title} · ` : "";
  const productNames = founder.products.map((p: any) => p.name).join(", ");
  const productSummary = productNames ? `Creator of ${productNames}.` : "";
  const description = founder.bio
    ? `${title}${founder.bio.slice(0, 160)}... ${productSummary}`
    : `${name} (${handle}) founder profile on The Launch Feed. ${title}${productSummary} Explore launched products, specifications, and community rankings.`;

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com";
  const canonicalUrl = `${siteUrl}/founder/${founder.username}`;
  return {
    title: `${name} - The Launch Feed`,
    description,
    keywords: [
      name,
      founder.username,
      handle,
      founder.title || "Tech Founder",
      ...founder.products.map((p: any) => p.name),
      ...founder.products.map((p: any) => p.category?.name || "Tech"),
      "startup founder",
      "software maker",
      "developer tools",
      "product launch",
      "The Launch Feed",
    ],
    authors: [{ name, url: canonicalUrl }],
    creator: name,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "profile",
      url: canonicalUrl,
      title: `${name} - The Launch Feed`,
      description,
      siteName: "The Launch Feed",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} - The Launch Feed`,
      description,
      creator: founder.twitterHandle ? `@${founder.twitterHandle.replace(/^@/, "")}` : undefined,
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

export default async function FounderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).trim();
  const built = await buildFounderViewWithSuggested(cleanSlug);
  if (!built) notFound();
  const { view, suggestedFounders } = built;
  // Fetch the raw profile once more for schema-only fields (email domain, etc.)
  const f = await getPublicProfile(cleanSlug);
  if (!f) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com";
  const canonicalUrl = `${siteUrl}/founder/${f.username}`;

  const sameAsUrls = [
    f.websiteUrl,
    f.twitterHandle ? (f.twitterHandle.startsWith("http") ? f.twitterHandle : `https://x.com/${f.twitterHandle.replace(/^@/, "")}`) : null,
    f.githubHandle ? (f.githubHandle.startsWith("http") ? f.githubHandle : `https://github.com/${f.githubHandle.replace(/^@/, "")}`) : null,
  ].filter(Boolean);

  const personId = `${canonicalUrl}#person`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      {
        "@type": "ProfilePage",
        "@id": `${canonicalUrl}#profile`,
        name: `${f.name || f.username} — Founder Profile`,
        url: canonicalUrl,
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": personId },
        mainEntity: { "@id": personId },
        breadcrumb: { "@id": `${canonicalUrl}#breadcrumb` },
      },
      {
        "@type": "Person",
        "@id": personId,
        name: f.name || f.username,
        alternateName: `@${f.username}`,
        identifier: f.username,
        url: canonicalUrl,
        image: f.image || `${siteUrl}/icon.svg`,
        jobTitle: f.title || "Founder & Software Maker",
        description: f.bio || undefined,
        sameAs: sameAsUrls,
        knowsAbout: f.products.map((p: any) => p.name),
        worksFor: { "@id": ORG_ID },
        makesOffer: f.products.map((p: any) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "SoftwareApplication",
            name: p.name,
            url: `${siteUrl}/product/${p.slug}`,
            applicationCategory: p.category?.name || "DeveloperApplication",
          },
        })),
      },
      {
        ...breadcrumb([
          { name: "Home", url: siteUrl },
          { name: "Founders", url: `${siteUrl}/founders` },
          { name: f.name || f.username, url: canonicalUrl },
        ]),
        "@id": `${canonicalUrl}#breadcrumb`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FounderClientView slug={cleanSlug} founder={view} suggestedFounders={suggestedFounders} />
    </>
  );
}
