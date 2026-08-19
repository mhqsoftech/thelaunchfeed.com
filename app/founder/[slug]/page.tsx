import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublicProfile } from "@/lib/queries/user";
import { buildFounderViewWithSuggested } from "@/lib/queries/founderView";
import { prisma } from "@/lib/db";
import FounderClientView from "./FounderClientView";
import { organizationNode, websiteNode, breadcrumb, ORG_ID, WEBSITE_ID, SITE_NAME } from "@/lib/seo/schema";

/**
 * Every historical handle a founder has used is kept in UsernameRedirect.
 * If the slug isn't a live handle but matches a past one, 308 to the current
 * URL so inbound links (SEO, social cards, embeds) never break on rename.
 * Returns null when no redirect applies, letting the caller notFound().
 */
async function resolveHistoricalUsername(cleanSlug: string): Promise<string | null> {
  const key = cleanSlug.replace(/^@/, "").trim().toLowerCase();
  if (!key) return null;
  const redirect = await prisma.usernameRedirect.findFirst({
    where: { oldUsername: { equals: key, mode: "insensitive" } },
    select: { userId: true },
  });
  if (!redirect) return null;
  const current = await prisma.user.findUnique({
    where: { id: redirect.userId },
    select: { username: true, isProfilePublic: true },
  });
  if (!current || !current.isProfilePublic) return null;
  if (current.username.toLowerCase() === key) return null;
  return current.username;
}

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).trim();
  let founder = await getPublicProfile(cleanSlug);
  if (!founder) {
    const currentUsername = await resolveHistoricalUsername(cleanSlug);
    if (currentUsername) founder = await getPublicProfile(currentUsername);
  }
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

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
  const canonicalUrl = `${siteUrl}/founder/${founder.username}`;
  // Use the founder's profile picture so every share card carries their face.
  const shareImage = founder.image || `${siteUrl}/og-default.png`;
  const absoluteShareImage = shareImage.startsWith("http")
    ? shareImage
    : `${siteUrl}${shareImage.startsWith("/") ? "" : "/"}${shareImage}`;
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
      images: [
        {
          url: absoluteShareImage,
          alt: `${name} (${handle}) on The Launch Feed`,
        },
      ],
    },
    twitter: {
      // Founder cards read best as a square avatar next to text.
      card: founder.image ? "summary" : "summary_large_image",
      title: `${name} - The Launch Feed`,
      description,
      creator: founder.twitterHandle ? `@${founder.twitterHandle.replace(/^@/, "")}` : undefined,
      images: [absoluteShareImage],
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
  const slugKey = cleanSlug.replace(/^@/, "").trim().toLowerCase();
  let built = await buildFounderViewWithSuggested(cleanSlug);
  if (!built) {
    const currentUsername = await resolveHistoricalUsername(cleanSlug);
    if (currentUsername) permanentRedirect(`/founder/${currentUsername}`);
    notFound();
  }
  // Canonicalisation — getPublicProfile matches by email prefix and name
  // too, so a fuzzy hit on an old handle would leave BOTH URLs returning 200
  // and Google would flag them as duplicate content. Always send the browser
  // (and crawlers) to the founder's live username.
  if (built.view.username && built.view.username.toLowerCase() !== slugKey) {
    permanentRedirect(`/founder/${built.view.username}`);
  }
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
