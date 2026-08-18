import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getSimilarProducts } from "@/lib/queries/products";
import { listCommentsForSlug } from "@/app/actions/comments";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAccoladeDetails } from "@/lib/awards";
import { computeAwardsForProduct } from "@/lib/queries/awards";
import ProductClientView, { type ViewProduct } from "./ProductClientView";

export const dynamic = "force-dynamic";
export const revalidate = 30;

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
  const ogImage = product.logoUrl || `${siteUrl}/icon.svg`;

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
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${product.name} — ${product.tagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} - The Launch Feed`,
      description,
      images: [ogImage],
      creator: product.owner.twitterHandle ? `@${product.owner.twitterHandle.replace(/^@/, "")}` : "@thelaunchfeed",
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

  // Run user lookup, cached similar products, and initial comments in parallel
  const [user, similarProducts, initialComments] = await Promise.all([
    getCurrentUser().catch(() => null),
    getSimilarProducts(p.categoryId, p.id).catch(() => []),
    listCommentsForSlug(cleanSlug).catch(() => []),
  ]);

  let initialHasVoted = false;
  let initialIsSaved = false;

  if (user) {
    const vote = await prisma.vote.findUnique({
      where: { productId_userId: { productId: p.id, userId: user.id } },
      select: { id: true },
    });
    initialHasVoted = !!vote;
    initialIsSaved = (user.savedProductIds ?? []).includes(p.id);
  }

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


  const isOwner = !!(
    user &&
    (user.id === p.ownerId ||
      (p.owner?.email && user.email.toLowerCase() === p.owner.email.toLowerCase()))
  );

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

  // Structured Data (JSON-LD) for Search Engines & AI Bots
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/product/${p.slug}#software`,
        name: p.name,
        headline: p.tagline,
        description: p.description || p.tagline,
        url: `${siteUrl}/product/${p.slug}`,
        applicationCategory: p.category?.name || "DeveloperApplication",
        operatingSystem: "All",
        image: p.logoUrl || `${siteUrl}/icon.svg`,
        author: {
          "@type": "Person",
          name: p.owner.name || p.owner.username,
          url: `${siteUrl}/founder/${p.owner.username}`,
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
            name: p.category?.name || "Products",
            item: p.category?.slug ? `${siteUrl}/category/${p.category.slug}` : `${siteUrl}/`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: p.name,
            item: `${siteUrl}/product/${p.slug}`,
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
