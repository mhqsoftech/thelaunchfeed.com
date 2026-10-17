import { getProductBySlug } from "@/lib/queries/products";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Launch badges on The Launch Feed";

export default async function BadgeOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const p = await getProductBySlug(decodeURIComponent(rawSlug).trim()).catch(() => null);
  const name = p?.name || "Launch badges";
  return ogCard({
    eyebrow: "Badges",
    title: p ? `${name} badges & trophies` : name,
    subtitle: "Official embeddable badges earned on The Launch Feed.",
    image: p?.logoUrl || "/logo.png",
    fallbackInitials: name.slice(0, 2),
    stats: p ? [{ label: "upvotes", value: p.voteCount ?? 0 }] : [],
  });
}
