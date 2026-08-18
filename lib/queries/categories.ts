import { prisma } from "@/lib/db";
import { formatProductWebsiteUrl } from "@/app/data";
import { GENUINE_PRODUCT_FILTER } from "@/lib/queries/products";

const SLUG_ALIASES: Record<string, string> = {
  "ai-tools": "ai",
  "ai-machine-learning": "ai",
  "developer-tools": "dev-tools",
  "devtools": "dev-tools",
  "design-tools": "design",
  "productivity-tools": "productivity",
  "opensource": "open-source",
  "open-source-software": "open-source",
  "fintech-payments": "fintech",
  "saas-cloud": "saas",
  "marketing": "saas",
  "seo": "seo-ai-visibility",
  "seo-tools": "seo-ai-visibility",
};

/**
 * Returns a category and all its live products, ordered by votes.
 * If seed data is delisted, authentic user products remain visible.
 */
export async function getCategoryBySlug(slug: string) {
  try {
    const normalized = slug.trim().toLowerCase();
    const targetSlug = SLUG_ALIASES[normalized] || normalized;

    const { getDelistedSections } = await import("@/lib/queries/products");
    const delistedSections: string[] = await getDelistedSections().catch(() => []);
    const isDelisted = delistedSections.includes("categories") || delistedSections.includes("all");

    let category = await prisma.category.findUnique({
      where: { slug: targetSlug },
      include: {
        products: {
          where: {
            status: "LIVE",
            ...(isDelisted ? GENUINE_PRODUCT_FILTER : {}),
          },
          orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
          select: {
            id: true,
            slug: true,
            name: true,
            tagline: true,
            description: true,
            logoUrl: true,
            websiteUrl: true,
            voteCount: true,
            commentCount: true,
            launchedAt: true,
            tags: true,
            owner: {
              select: { username: true, name: true, image: true },
            },
            revenue: {
              select: { isVerified: true, mrrCents: true },
            },
          },
        },
      },
    }).catch(() => null);

    if (!category) {
      category = await prisma.category.findFirst({
        where: {
          OR: [
            { slug: { equals: targetSlug, mode: "insensitive" } },
            { name: { equals: targetSlug, mode: "insensitive" } },
          ],
        },
        include: {
          products: {
            where: {
              status: "LIVE",
              ...(isDelisted ? GENUINE_PRODUCT_FILTER : {}),
            },
            orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
            select: {
              id: true,
              slug: true,
              name: true,
              tagline: true,
              description: true,
              logoUrl: true,
              websiteUrl: true,
              voteCount: true,
              commentCount: true,
              launchedAt: true,
              tags: true,
              owner: {
                select: { username: true, name: true, image: true },
              },
              revenue: {
                select: { isVerified: true, mrrCents: true },
              },
            },
          },
        },
      }).catch(() => null);
    }

    if (!category) return null;

    return {
      ...category,
      products: category.products.map((p) => ({
        ...p,
        websiteUrl: formatProductWebsiteUrl(p.websiteUrl),
      })),
    };
  } catch (err) {
    console.error(`[getCategoryBySlug] error loading slug "${slug}":`, err);
    return null;
  }
}

export const getCategoryWithProducts = getCategoryBySlug;

/**
 * Returns all category slugs for static page generation.
 */
export async function getAllCategorySlugs() {
  return prisma.category.findMany({
    select: { slug: true },
  });
}

let categoriesCountCache: {
  data: { id: string; slug: string; name: string; productCount: number }[];
  timestamp: number;
} | null = null;
const CATEGORIES_CACHE_TTL_MS = 60_000; // 60s

export function invalidateCategoriesCache() {
  categoriesCountCache = null;
}

/**
 * All categories with product counts — used for the category index
 * or any listing that needs to show how many products exist per category.
 */
export async function getCategoriesWithCounts() {
  if (categoriesCountCache && Date.now() - categoriesCountCache.timestamp < CATEGORIES_CACHE_TTL_MS) {
    return categoriesCountCache.data;
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      _count: {
        select: {
          products: {
            where: { status: "LIVE" },
          },
        },
      },
    },
  });

  const data = categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    productCount: c._count.products,
  }));

  categoriesCountCache = { data, timestamp: Date.now() };
  return data;
}

/**
 * Lean list of categories for dropdowns and filter bars.
 */
export async function getCategoriesList() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}
