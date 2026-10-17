import type { Metadata } from "next";
import Link from "next/link";
import MainLayoutShell from "@/app/MainLayoutShell";
import { prisma } from "@/lib/db";
import { SITE_URL, WEBSITE_ID, breadcrumb } from "@/lib/seo/schema";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Browse Software & AI Product Categories | The Launch Feed",
  description:
    "Explore every product category on The Launch Feed — AI tools, developer tools, SaaS, design, productivity and more — with the top-voted launches in each.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "Browse Product Categories | The Launch Feed",
    description: "Every category on The Launch Feed with its top-voted launches.",
    url: `${SITE_URL}/categories`,
  },
};

async function loadCategories() {
  try {
    const cats = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        _count: { select: { products: { where: { status: "LIVE" } } } },
        products: {
          where: { status: "LIVE" },
          orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
          take: 3,
          select: { id: true, slug: true, name: true, logoUrl: true, voteCount: true },
        },
      },
    });
    return cats
      .map((c) => ({ ...c, count: c._count.products }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  } catch (err) {
    console.error("[categories] load failed:", err);
    return [];
  }
}

export default async function CategoriesPage() {
  const categories = await loadCategories();
  const total = categories.reduce((n, c) => n + c.count, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/categories#page`,
        url: `${SITE_URL}/categories`,
        name: "Product categories",
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: categories.length,
          itemListElement: categories.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}/category/${c.slug}`,
            name: c.name,
          })),
        },
      },
      breadcrumb([
        { name: "The Launch Feed", url: SITE_URL },
        { name: "Categories", url: `${SITE_URL}/categories` },
      ]),
    ],
  };

  return (
    <MainLayoutShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="space-y-6">
        <header className="relative overflow-hidden rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card px-5 py-6 sm:px-7">
          <div className="tlf-signal-grid absolute inset-0 pointer-events-none" aria-hidden />
          <div className="relative">
            <nav aria-label="Breadcrumb" className="text-xs text-ink-faint">
              <Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> Categories
            </nav>
            <h1 className="mt-2 font-display font-black uppercase tracking-wide text-[26px] sm:text-[34px] leading-[1.05] text-ink">
              Browse by category
            </h1>
            <p className="mt-2 text-sm text-ink-dim max-w-xl">
              {categories.length} categories and {total.toLocaleString("en-US")} live products. Each category page ranks its
              launches by community upvotes.
            </p>
          </div>
        </header>

        {categories.length === 0 ? (
          <p className="text-sm text-ink-dim">No categories yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/category/${c.slug}`}
                  className="group flex h-full flex-col gap-4 p-4 rounded-[var(--radius-card)] border border-hairline bg-card hover:border-ink-faint hover:shadow-[var(--shadow-lift)] hover:-translate-y-px transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold text-ink group-hover:text-signal transition-colors">{c.name}</h2>
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-surface font-mono text-xs text-ink-dim tabular-nums">
                      {c.count}
                    </span>
                  </div>
                  {c.products.length > 0 ? (
                    <ul className="space-y-1.5 text-sm">
                      {c.products.map((p, i) => (
                        <li key={p.id} className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-4 font-mono text-xs ${i === 0 ? "text-signal font-bold" : "text-ink-faint"}`}>{i + 1}</span>
                          <span className="w-6 h-6 shrink-0 overflow-hidden rounded-md border border-hairline bg-surface">
                            {p.logoUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.logoUrl} alt="" width={24} height={24} loading="lazy" className="w-full h-full object-cover" />
                            )}
                          </span>
                          <span className="flex-1 truncate text-ink-dim">{p.name}</span>
                          <span className="font-mono text-xs text-ink-faint tabular-nums">▲{p.voteCount}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-faint">No launches yet — be the first.</p>
                  )}
                  <span className="mt-auto text-xs font-semibold text-signal">Explore {c.name} →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MainLayoutShell>
  );
}
