import { prisma } from "@/lib/db";
import type { SlotPosition } from "@prisma/client";

export type PublicSlot = {
  id: string;
  kind: "PAID" | "CUSTOM";
  name: string;
  tagline: string;
  /** Where the card links: the maker's own website when we have it. */
  url: string;
  /** true when `url` leaves the site (open in a new tab, mark as sponsored if PAID). */
  external: boolean;
  logoUrl?: string | null;
  /** Linked product — external clicks go through /go/<productSlug> to be counted. */
  productSlug?: string | null;
  /** Real FeaturedSlot id (lets /go honour the slot's own custom URL). */
  slotId?: string | null;
};

/**
 * Featured / Spotlight cards send visitors straight to the product's real
 * website (the URL the maker entered at submission), not our product page.
 * Priority: an explicit external customUrl → the linked product's
 * websiteUrl → our internal page as a last resort.
 */
function resolveSlotUrl(customUrl: string | null, product: { slug: string; websiteUrl: string } | null) {
  const isExternal = (u?: string | null) => !!u && /^https?:\/\//i.test(u.trim());
  if (isExternal(customUrl)) return { url: customUrl!.trim(), external: true };
  if (product?.websiteUrl?.trim()) {
    const site = product.websiteUrl.trim();
    return { url: /^https?:\/\//i.test(site) ? site : `https://${site}`, external: true };
  }
  if (customUrl?.trim()) return { url: customUrl.trim(), external: false };
  return { url: product ? `/product/${product.slug}` : "#", external: false };
}

type SlotCacheEntry = {
  timestamp: number;
  data: PublicSlot[];
};

const slotsServerCache = new Map<string, SlotCacheEntry>();
const SLOTS_CACHE_TTL_MS = 60_000; // 60 seconds

export function invalidateSlotsCache() {
  slotsServerCache.clear();
}

/**
 * Public helper for MainLayoutShell / hero strip.
 * Merges paid + custom placements for the given position, ordered:
 *   1. paid rows first (they pay for priority)
 *   2. then custom rows by their `order` field
 * If seed slots are delisted, authentic paid slots and genuine launches remain active.
 */
export async function getPublicSlots(position: SlotPosition): Promise<PublicSlot[]> {
  const { getDelistedSections } = await import("@/lib/queries/products");
  const delistedSections = await getDelistedSections();
  const isDelisted = delistedSections.includes("featured") || delistedSections.includes("all");

  const cacheKey = `slots-${position}-${isDelisted ? "delisted" : "all"}`;
  const cached = slotsServerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SLOTS_CACHE_TTL_MS) {
    return cached.data;
  }

  const now = new Date();
  const rows = await prisma.featuredSlot.findMany({
    where: {
      // $10 Premium Spotlight buys BOTH placements: its paid ROTATING slot is
      // also shown in the FEATURED strip (one purchase, one 30-day window).
      ...(position === "FEATURED"
        ? { OR: [{ position: "FEATURED" as const }, { position: "ROTATING" as const, kind: "PAID" as const }] }
        : { position }),
      startsAt: { lte: now },
      AND: [
        {
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        {
          OR: isDelisted
            ? [
                { kind: "PAID" },
                {
                  product: {
                    status: "LIVE",
                    launchedAt: { lte: now },
                    fromSubmission: { isNot: null },
                  },
                },
              ]
            : [
                { productId: null },
                {
                  product: {
                    status: "LIVE",
                    launchedAt: { lte: now },
                  },
                },
              ],
        },
      ],
    },
    orderBy: [{ kind: "asc" }, { order: "asc" }],
    include: {
      product: { select: { slug: true, name: true, tagline: true, logoUrl: true, websiteUrl: true } },
    },
  });

  const data = rows.map((s): PublicSlot => {
    if (s.kind === "PAID") {
      return {
        id: s.id,
        kind: "PAID",
        name: s.customName || s.product?.name || "",
        tagline: s.customTagline ?? s.product?.tagline ?? "",
        ...resolveSlotUrl(s.customUrl, s.product),
        logoUrl: s.customLogoUrl || s.product?.logoUrl || null,
        productSlug: s.product?.slug ?? null,
        slotId: s.id,
      };
    }
    return {
      id: s.id,
      kind: "CUSTOM",
      name: s.customName || s.product?.name || "",
      tagline: s.customTagline ?? s.product?.tagline ?? "",
      ...resolveSlotUrl(s.customUrl, s.product),
      logoUrl: s.customLogoUrl || s.product?.logoUrl || null,
    };
  });

  // A product with both a $5 and a $10 slot appears once.
  const seen = new Set<string>();
  const unique = data.filter((d) => {
    const key = `${d.name}|${d.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  slotsServerCache.set(cacheKey, { timestamp: Date.now(), data: unique });
  return unique;
}
