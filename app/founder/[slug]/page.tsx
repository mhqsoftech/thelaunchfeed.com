import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicProfile, getSuggestedFounders } from "@/lib/queries/user";
import { decryptPaymentApiKey } from "@/lib/crypto";
import { fetchLiveRevenueFromSDK } from "@/app/lib/revenueTelemetrySDK";
import FounderClientView, { type ViewFounder } from "./FounderClientView";

export const dynamic = "force-dynamic";
export const revalidate = 30;

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
  const ogImage = founder.image || `${siteUrl}/icon.svg`;

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
          url: ogImage,
          width: 400,
          height: 400,
          alt: `${name} Founder Profile`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${name} - The Launch Feed`,
      description,
      images: [ogImage],
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
  const f = await getPublicProfile(cleanSlug);
  if (!f) notFound();

  const totalVotes = f.products.reduce((s: number, p: any) => s + p.voteCount, 0);

  let verifiedMrrCents = 0;
  let verifiedTotalRevenueCents = 0;
  let verifiedMrrFormatted = "";
  let verifiedProviderName = "Stripe";

  // Skip assumed/mock revenue from founder pages.
  // Only display revenue if the user explicitly opted-in to public revenue verification
  if (f.showRevenuePublic) {
    const verifiedRevenues = f.products
      .map((p: any) => p.revenue)
      .filter((r: any): r is NonNullable<typeof r> => !!r && r.isVerified);

    verifiedMrrCents = verifiedRevenues.reduce((sum: number, r: any) => sum + (r.mrrCents || 0), 0);
    verifiedTotalRevenueCents = verifiedRevenues.reduce((sum: number, r: any) => sum + (r.totalRevenueCents || 0), 0);

    if (verifiedMrrCents > 0) {
      if (verifiedMrrCents >= 100000) {
        verifiedMrrFormatted = `$${(verifiedMrrCents / 100000).toFixed(1)}K / mo`;
      } else {
        const dollars = verifiedMrrCents / 100;
        verifiedMrrFormatted = `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)} / mo`;
      }
    }

    if (f.revenueConnections && f.revenueConnections.length > 0) {
      const primaryConn = f.revenueConnections[0];
      const prov = primaryConn.provider.toLowerCase();
      verifiedProviderName =
        prov.charAt(0).toUpperCase() + prov.slice(1);

      if (!verifiedMrrFormatted || verifiedMrrFormatted === "$0" || verifiedMrrFormatted === "$0 / mo") {
        try {
          const decryptedKey = decryptPaymentApiKey(primaryConn.accessToken);
          // Timeout after 600ms so third party APIs never hang the founder page
          const telemetry = await Promise.race([
            fetchLiveRevenueFromSDK(prov, decryptedKey),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 600)),
          ]);
          if (telemetry && telemetry.mrrCents > 0) {
            verifiedMrrCents = telemetry.mrrCents;
            verifiedTotalRevenueCents = telemetry.totalRevenueCents;
            verifiedMrrFormatted = telemetry.mrrFormatted;
          }
        } catch {
          // Ignore
        }
      }
    }
  }

  const view: ViewFounder = {
    id: f.id,
    username: f.username,
    name: f.name || f.username,
    handle: `@${f.username}`,
    bio: f.bio || "",
    image: f.image || null,
    website: f.websiteUrl || "",
    twitter: f.twitterHandle || "",
    github: f.githubHandle || "",
    revenue: verifiedMrrFormatted,
    mrrCents: verifiedMrrCents,
    totalRevenueCents: verifiedTotalRevenueCents,
    revenueProvider: verifiedProviderName,
    title: f.title || "",
    totalVotes,
    productsCount: f.products.length,
    joinedAt: new Date(f.createdAt).toISOString().slice(0, 10),
    products: f.products.map((p: any) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      category: p.category?.name ?? "Uncategorized",
      logoUrl: p.logoUrl ?? null,
      websiteUrl: p.websiteUrl ?? null,
      tags: p.tags ?? [],
      commentCount: p.commentCount ?? 0,
      votes: p.voteCount,
      revenue: p.revenue?.isVerified
        ? (p.revenue.mrrCents >= 100000
            ? `$${(p.revenue.mrrCents / 100000).toFixed(1)}K / mo`
            : `$${(p.revenue.mrrCents / 100).toFixed(p.revenue.mrrCents % 100 === 0 ? 0 : 2)} / mo`)
        : "",
      launchedAt: new Date(p.launchedAt).toISOString().slice(0, 10),
    })),
  };

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com";
  const canonicalUrl = `${siteUrl}/founder/${f.username}`;

  const sameAsUrls = [
    f.websiteUrl,
    f.twitterHandle ? (f.twitterHandle.startsWith("http") ? f.twitterHandle : `https://x.com/${f.twitterHandle.replace(/^@/, "")}`) : null,
    f.githubHandle ? (f.githubHandle.startsWith("http") ? f.githubHandle : `https://github.com/${f.githubHandle.replace(/^@/, "")}`) : null,
  ].filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": `${canonicalUrl}#profile`,
        name: `${f.name || f.username} — Founder Profile`,
        url: canonicalUrl,
        mainEntity: {
          "@type": "Person",
          name: f.name || f.username,
          alternateName: `@${f.username}`,
          identifier: f.username,
          url: canonicalUrl,
          image: f.image || `${siteUrl}/icon.svg`,
          jobTitle: f.title || "Founder & Software Maker",
          description: f.bio || undefined,
          sameAs: sameAsUrls,
          knowsAbout: f.products.map((p: any) => p.name),
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
            name: "Founders",
            item: `${siteUrl}/founders`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: f.name || f.username,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };

  const suggestedFounders = await getSuggestedFounders(f.username, 12);

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
