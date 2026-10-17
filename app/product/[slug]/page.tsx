import { publicDetails } from "@/lib/free-launch";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getSimilarProducts } from "@/lib/queries/products";
import { listCommentsForSlug } from "@/app/actions/comments";
import { getAccoladeDetails } from "@/lib/awards";
import { computeAwardsForProductTimegated } from "@/lib/queries/awards";
import ProductClientView, { type ViewProduct } from "./ProductClientView";
import { breadcrumb, ORG_ID, WEBSITE_ID, SITE_URL, SITE_NAME } from "@/lib/seo/schema";

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
  // Social cards come from ./opengraph-image.tsx (a PNG with the logo,
  // tagline and votes); maker uploads are AVIF, which most crawlers ignore.
  const pageTitle = `${product.name} - Product | The Launch Feed`;
  return {
    title: pageTitle,
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
      title: pageTitle,
      description,
      siteName: "The Launch Feed",
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
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

  const rawAwards = await computeAwardsForProductTimegated(p);
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
    categorySlug: p.category?.slug ?? null,
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
    // Never ship secrets or internal bookkeeping to the browser.
    details: publicDetails(p.details) as any,
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

  // Structured Data (JSON-LD) for search engines and AI answer engines.
  // Only facts the maker actually entered — no invented ratings or prices.
  const d = (view.details || {}) as Record<string, any>;
  const ogImage = `${productUrl}/opengraph-image`;
  const features: string[] = Array.isArray(d.features) ? d.features.filter((f: unknown) => typeof f === "string" && f.trim()) : [];
  const faqs: Array<{ q: string; a: string }> = Array.isArray(d.faqs)
    ? d.faqs.filter((f: any) => f && typeof f.q === "string" && typeof f.a === "string" && f.q.trim() && f.a.trim())
    : [];
  const offers = (Array.isArray(d.pricingTiers) ? d.pricingTiers : [])
    .map((t: any) => {
      const raw = String(t?.price ?? "").trim();
      const free = /^(free|\$?0(\.0+)?)(\b|\/|$)/i.test(raw);
      const num = free ? 0 : Number((raw.match(/\d+(?:\.\d+)?/) || [])[0]);
      if (!raw || !Number.isFinite(num)) return null;
      return {
        "@type": "Offer",
        name: String(t?.name || (free ? "Free" : "Paid")).slice(0, 60),
        price: num.toFixed(2),
        priceCurrency: "USD",
        ...(t?.specs ? { description: String(t.specs).slice(0, 200) } : {}),
      };
    })
    .filter(Boolean);
  // Bare URLs (no ?ref= tracking) so search engines can match the entity.
  const bareUrl = (u: unknown) => {
    if (typeof u !== "string" || !/^https?:\/\//i.test(u)) return null;
    try {
      const x = new URL(u);
      x.search = "";
      x.hash = "";
      return x.toString();
    } catch {
      return null;
    }
  };
  const absUrl = (u: string | null | undefined) => (!u ? null : /^https?:\/\//i.test(u) ? u : `${siteUrl}${u.startsWith("/") ? "" : "/"}${u}`);
  const productSameAs = [bareUrl(p.websiteUrl), bareUrl(d.githubUrl)].filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemPage",
        "@id": `${productUrl}#webpage`,
        url: productUrl,
        name: `${p.name} - Product | ${SITE_NAME}`,
        description: p.tagline,
        inLanguage: "en",
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: { "@id": `${productUrl}#software` },
        primaryImageOfPage: { "@type": "ImageObject", url: ogImage, width: 1200, height: 630 },
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
        ...(productSameAs.length ? { sameAs: productSameAs } : {}),
        applicationCategory: p.category?.name || "BusinessApplication",
        operatingSystem: "Web",
        image: [ogImage, ...(p.logoUrl ? [absUrl(p.logoUrl)] : [])],
        ...((p.screenshots ?? []).length ? { screenshot: (p.screenshots ?? []).slice(0, 4).map(absUrl) } : {}),
        ...(features.length ? { featureList: features.slice(0, 12).join(", ") } : {}),
        ...(typeof d.latestVersion === "string" && d.latestVersion.trim() ? { softwareVersion: d.latestVersion.trim() } : {}),
        ...((p.tags ?? []).length ? { keywords: (p.tags ?? []).join(", ") } : {}),
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
        interactionStatistic: [
          { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: p.voteCount },
          { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: initialComments.length },
        ],
        ...(offers.length ? { offers } : {}),
      },
      ...(faqs.length
        ? [
            {
              "@type": "FAQPage",
              "@id": `${productUrl}#faq`,
              isPartOf: { "@id": `${productUrl}#webpage` },
              mainEntity: faqs.slice(0, 10).map((f) => ({
                "@type": "Question",
                name: f.q.trim(),
                acceptedAnswer: { "@type": "Answer", text: f.a.trim() },
              })),
            },
          ]
        : []),
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
