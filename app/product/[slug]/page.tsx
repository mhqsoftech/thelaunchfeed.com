import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getSimilarProducts } from "@/lib/queries/products";
import { listCommentsForSlug } from "@/app/actions/comments";
import { getAccoladeDetails } from "@/lib/awards";
import { computeAwardsForProduct } from "@/lib/queries/awards";
import ProductClientView, { type ViewProduct } from "./ProductClientView";
import { organizationNode, websiteNode, breadcrumb, ORG_ID, WEBSITE_ID, SITE_URL, SITE_NAME } from "@/lib/seo/schema";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).trim();
  const product = await getProductBySlug(cleanSlug);
  if (!product) {
    return {
      title: "Product Not Found - The Launch Feed",
      robots: { index: false, follow: false },
    };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
  const canonicalUrl = `${siteUrl}/product/${product.slug}`;
  const description = product.description || product.tagline || `${product.name} on The Launch Feed. Discover technical architecture, 360° product specs, and community upvotes.`;
  // Prefer the first screenshot for a large social card, fall back to the
  // product logo so at minimum the product's mark shows up in every share.
  const shareImage =
    (Array.isArray(product.screenshots) && product.screenshots[0]) ||
    product.logoUrl ||
    `${siteUrl}/og-default.png`;
  const absoluteShareImage = shareImage.startsWith("http") ? shareImage : `${siteUrl}${shareImage.startsWith("/") ? "" : "/"}${shareImage}`;
  return {
    title: `${product.name} - The Launch Feed`,
    description,
    keywords: [
      product.name,
      product.category?.name || "Software",
      ...(product.tags || []),
      "The Launch Feed",
      "tech product launch",
      "software architecture",
      "360 degree product specs",
      "developer tools",
      "SaaS discovery",
    ],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      title: `${product.name} - The Launch Feed`,
      description,
      siteName: "The Launch Feed",
      images: [
        {
          url: absoluteShareImage,
          alt: `${product.name} — ${product.tagline || "on The Launch Feed"}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} - The Launch Feed`,
      description,
      creator: product.owner.twitterHandle ? `@${product.owner.twitterHandle.replace(/^@/, "")}` : "@thelaunchfeed",
      images: [absoluteShareImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).trim();
  const p = await getProductBySlug(cleanSlug);
  if (!p) notFound();

  // Public render only — vote/save state hydrates client-side from /api/me
  // via SessionBridge, so the page can be ISR-cached at the edge.
  const [similarProducts, initialComments] = await Promise.all([
    getSimilarProducts(p.categoryId, p.id).catch(() => []),
    listCommentsForSlug(cleanSlug).catch(() => []),
  ]);
  const initialHasVoted = false;
  const initialIsSaved = false;

  const isRevenueVerified = !!p.revenue?.isVerified;
  const mrrCents = isRevenueVerified ? (p.revenue?.mrrCents ?? 0) : 0;
  const totalRevenueCents = isRevenueVerified ? (p.revenue?.totalRevenueCents ?? 0) : 0;
  let revenueFormatted = "";
  if (isRevenueVerified && mrrCents > 0) {
    if (mrrCents >= 100000) {
      revenueFormatted = `$${(mrrCents / 100000).toFixed(1)}K / mo`;
    } else {
      const dollars = mrrCents / 100;
      revenueFormatted = `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)} / mo`;
    }
  }

  const rawProv = p.revenue?.connection?.provider || "STRIPE";
  const revenueProvider =
    rawProv.charAt(0).toUpperCase() + rawProv.slice(1).toLowerCase();

  const rawAwards = await computeAwardsForProduct(p);
  const accolades = getAccoladeDetails(rawAwards, p.slug, { revenueFormatted });

  const view: ViewProduct = {
    id: p.id,
    ownerId: p.ownerId,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    description: p.description ?? "",
    websiteUrl: p.websiteUrl,
    logoUrl: p.logoUrl ?? null,
    screenshots: p.screenshots ?? [],
    videoUrl: p.videoUrl ?? null,
    tags: p.tags ?? [],
    category: p.category?.name ?? "Uncategorized",
    launchedAt: new Date(p.launchedAt).toISOString().slice(0, 10),
    updatedAt: (p as any).updatedAt ? new Date((p as any).updatedAt).toISOString() : null,
    votes: p.voteCount,
    maker: `@${p.owner.username}`,
    makerName: p.owner.name || p.owner.username,
    makerUsername: p.owner.username,
    makerImage: p.owner.image ?? null,
    makerTitle: p.owner.title ?? null,
    makerBio: p.owner.bio ?? null,
    makerTwitter: p.owner.twitterHandle ?? null,
    makerGithub: p.owner.githubHandle ?? null,
    makerWebsite: p.owner.websiteUrl ?? null,
    dailyRank: p.dailyRank,
    weeklyRank: p.weeklyRank,
    monthlyRank: p.monthlyRank,
    rawAwards,
    accolades,
    details: (p.details as any) ?? null,
    revenue: revenueFormatted,
    mrrCents,
    totalRevenueCents,
    revenueProvider,
    isRevenueVerified,
  };


  // isOwner is determined client-side after session hydration to keep this page cacheable.
  const isOwner = false;

  const siteUrl = SITE_URL;
  const productUrl = `${siteUrl}/product/${p.slug}`;
  const founderUrl = `${siteUrl}/founder/${p.owner.username}`;
  const founderSameAs = [
    p.owner.websiteUrl || null,
    p.owner.twitterHandle
      ? (p.owner.twitterHandle.startsWith("http")
          ? p.owner.twitterHandle
          : `https://x.com/${p.owner.twitterHandle.replace(/^@/, "")}`)
      : null,
    p.owner.githubHandle
      ? (p.owner.githubHandle.startsWith("http")
          ? p.owner.githubHandle
          : `https://github.com/${p.owner.githubHandle.replace(/^@/, "")}`)
      : null,
  ].filter(Boolean);

  const launchedIso = new Date(p.launchedAt).toISOString();
  const updatedIso = new Date((p as any).updatedAt || p.launchedAt).toISOString();

  // Structured Data (JSON-LD) for Search Engines & AI Bots
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      {
        "@type": "WebPage",
        "@id": `${productUrl}#webpage`,
        url: productUrl,
        name: `${p.name} — ${SITE_NAME}`,
        isPartOf: { "@id": WEBSITE_ID },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: p.logoUrl || `${siteUrl}/icon.svg`,
        },
        datePublished: launchedIso,
        dateModified: updatedIso,
        breadcrumb: { "@id": `${productUrl}#breadcrumb` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${productUrl}#software`,
        name: p.name,
        headline: p.tagline,
        description: p.description || p.tagline,
        url: productUrl,
        applicationCategory: p.category?.name || "DeveloperApplication",
        operatingSystem: "All",
        image: p.logoUrl || `${siteUrl}/icon.svg`,
        datePublished: launchedIso,
        dateModified: updatedIso,
        publisher: { "@id": ORG_ID },
        author: {
          "@type": "Person",
          "@id": `${founderUrl}#person`,
          name: p.owner.name || p.owner.username,
          url: founderUrl,
          ...(founderSameAs.length ? { sameAs: founderSameAs } : {}),
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "5.0",
          reviewCount: Math.max(1, p.voteCount),
          bestRating: "5",
          worstRating: "1",
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
      {
        ...breadcrumb([
          { name: "Home", url: siteUrl },
          {
            name: p.category?.name || "Products",
            url: p.category?.slug
              ? `${siteUrl}/category/${p.category.slug}`
              : `${siteUrl}/`,
          },
          { name: p.name, url: productUrl },
        ]),
        "@id": `${productUrl}#breadcrumb`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductClientView
        slug={cleanSlug}
        product={view}
        initialHasVoted={initialHasVoted}
        initialIsSaved={initialIsSaved}
        isOwner={isOwner}
        similarProducts={similarProducts}
        initialComments={initialComments}
      />
    </>
  );
}
