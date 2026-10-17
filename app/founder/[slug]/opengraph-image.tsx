import { getPublicProfile } from "@/lib/queries/user";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Founder profile on The Launch Feed";

export default async function FounderOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim();
  const f = await getPublicProfile(slug).catch(() => null);

  const name = f?.name || f?.username || "Founder";
  const products = f?.products || [];
  const votes = products.reduce((s: number, p: any) => s + (p.voteCount || 0), 0);
  return ogCard({
    eyebrow: "Founder",
    title: name,
    subtitle: f?.title || f?.bio || "Founder & software maker",
    image: f?.image || null,
    imageShape: "circle",
    fallbackInitials: name.slice(0, 2),
    stats: f
      ? [
          { label: products.length === 1 ? "product" : "products", value: products.length },
          { label: "upvotes", value: votes },
        ]
      : [],
    footnote: f?.username ? `@${f.username}` : null,
  });
}
