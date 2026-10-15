/**
 * Client-safe helpers for tracked outbound links (no server imports).
 *
 * Every link to a maker's website goes through /go/<slug>?src=<placement>,
 * which records the visit and 302s to the site with ?ref=thelaunchfeed.
 * See app/go/[slug]/route.ts and lib/outbound/track.ts.
 */

export const OUTBOUND_SOURCES = ["product_page", "featured", "spotlight", "feed", "badge"] as const;
export type OutboundSource = (typeof OUTBOUND_SOURCES)[number];

/** Placements that send visitors to the maker. `badge` is the reverse
 *  direction (maker's site → us) and is reported separately. */
export const SENT_SOURCES: readonly OutboundSource[] = ["product_page", "featured", "spotlight", "feed"];

export const SOURCE_LABELS: Record<OutboundSource, string> = {
  product_page: "Product page",
  featured: "Featured ticker",
  spotlight: "Spotlight",
  feed: "RSS feed",
  badge: "Your badge",
};

export function isOutboundSource(v: unknown): v is OutboundSource {
  return typeof v === "string" && (OUTBOUND_SOURCES as readonly string[]).includes(v);
}

/** Relative tracked URL for a product's website. `slot` pins a Featured /
 *  Spotlight card whose destination is the slot's own custom URL. */
export function goHref(slug: string, src: OutboundSource, slot?: string | null): string {
  const qs = new URLSearchParams({ src });
  if (slot) qs.set("slot", slot);
  return `/go/${encodeURIComponent(slug)}?${qs.toString()}`;
}
