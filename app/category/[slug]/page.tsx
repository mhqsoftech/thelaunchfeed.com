import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCategoryBySlug,
  getAllCategorySlugs,
  getCategoriesWithCounts,
} from "@/lib/queries/categories";
import CategoryClientView from "./CategoryClientView";
import { organizationNode, websiteNode, breadcrumb, ORG_ID, WEBSITE_ID, SITE_NAME } from "@/lib/seo/schema";

export const revalidate = 300;

/* ───────────── Static Params for build ───────────── */

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((c) => ({ slug: c.slug }));
}

/* ───────────── SEO Metadata ───────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).trim();
  const category = await getCategoryBySlug(cleanSlug);
  if (!category) {
    return {
      title: "Category Not Found - The Launch Feed",
      robots: { index: false, follow: false },
    };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
  const canonicalUrl = `${siteUrl}/category/${category.slug}`;
  const count = category.products.length;
  const desc = `Explore ${count} ${category.name.toLowerCase()} tool${
    count !== 1 ? "s" : ""
  } and software products launched on The Launch Feed. Discover architecture specs, founder stories, and community rankings in ${
    category.name
  }.`;

  return {
    title: `${category.name} - The Launch Feed`,
    description: desc,
    keywords: [
      category.name,
      `${category.name} software`,
      `${category.name} tools`,
      `${category.name} apps`,
      "The Launch Feed",
      "tech directory",
      "SaaS discovery",
      "product leaderboard",
    ],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${category.name} - The Launch Feed`,
      description: desc,
      type: "website",
      url: canonicalUrl,
      siteName: "The Launch Feed",
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.name} - The Launch Feed`,
      description: desc,
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
}

/* ───────────── Page Component ───────────── */

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).trim();
  const category = await getCategoryBySlug(cleanSlug);
  if (!category) notFound();

  const allCategories = await getCategoriesWithCounts();
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

  const categoryUrl = `${siteUrl}/category/${category.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      {
        "@type": "CollectionPage",
        "@id": `${categoryUrl}#page`,
        name: `${category.name} Products — ${SITE_NAME}`,
        description: `Curated directory of ${category.name} software and tools launched on ${SITE_NAME}.`,
        url: categoryUrl,
        isPartOf: { "@id": WEBSITE_ID },
        publisher: { "@id": ORG_ID },
        breadcrumb: { "@id": `${categoryUrl}#breadcrumb` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: category.products.length,
          itemListOrder: "https://schema.org/ItemListOrderDescending",
          itemListElement: category.products.map((p, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            url: `${siteUrl}/product/${p.slug}`,
            item: {
              "@type": "SoftwareApplication",
              name: p.name,
              url: `${siteUrl}/product/${p.slug}`,
              applicationCategory: category.name,
              ...((p as any).logoUrl ? { image: (p as any).logoUrl } : {}),
              ...((p as any).tagline ? { description: (p as any).tagline } : {}),
            },
          })),
        },
      },
      {
        ...breadcrumb([
          { name: "Home", url: siteUrl },
          { name: "Categories", url: `${siteUrl}/` },
          { name: category.name, url: categoryUrl },
        ]),
        "@id": `${categoryUrl}#breadcrumb`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CategoryClientView
        category={category}
        allCategories={allCategories}
      />
    </>
  );
}
