import { getProductBySlug } from "@/lib/queries/products";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Product launch on The Launch Feed";

export default async function ProductOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim();
  const p = await getProductBySlug(slug).catch(() => null);

  const name = p?.name || "The Launch Feed";
  const maker = p?.owner?.name || p?.owner?.username || "";
  return ogCard({
    eyebrow: p?.category?.name || "Product launch",
    title: name,
    subtitle: p?.tagline || "Ship. Vote. Rise.",
    image: p?.logoUrl || null,
    fallbackInitials: name.slice(0, 2),
    stats: p ? [{ label: "upvotes", value: p.voteCount ?? 0 }] : [],
    footnote: maker ? `by ${maker}` : null,
  });
}
