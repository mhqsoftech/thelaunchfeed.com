import { getCategoryBySlug } from "@/lib/queries/categories";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Product category on The Launch Feed";

export default async function CategoryOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim();
  const c = await getCategoryBySlug(slug).catch(() => null);

  const name = c?.name || "Category";
  const products = (c?.products || []) as Array<{ name: string }>;
  const top = products.slice(0, 4).map((p) => p.name);
  return ogCard({
    eyebrow: "Category",
    title: `Best ${name} launches`,
    subtitle: top.length ? `Featuring ${top.join(", ")}` : `New ${name} products, ranked daily by the community.`,
    image: "/logo.png",
    stats: c ? [{ label: products.length === 1 ? "product" : "products", value: products.length }] : [],
  });
}
