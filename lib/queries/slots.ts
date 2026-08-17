import { prisma } from "@/lib/db";
import type { SlotPosition } from "@prisma/client";

export type PublicSlot = {
  id: string;
  kind: "PAID" | "CUSTOM";
  name: string;
  tagline: string;
  url: string;
  logoUrl?: string | null;
};

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
      position,
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
      product: { select: { slug: true, name: true, tagline: true, logoUrl: true } },
    },
  });

  const data = rows.map((s): PublicSlot => {
    if (s.kind === "PAID") {
      return {
        id: s.id,
        kind: "PAID",
        name: s.customName || s.product?.name || "",
        tagline: s.customTagline ?? s.product?.tagline ?? "",
        url: s.customUrl || (s.product ? `/product/${s.product.slug}` : "#"),
        logoUrl: s.customLogoUrl || s.product?.logoUrl || null,
      };
    }
    return {
      id: s.id,
      kind: "CUSTOM",
      name: s.customName || s.product?.name || "",
      tagline: s.customTagline ?? s.product?.tagline ?? "",
      url: s.customUrl || (s.product ? `/product/${s.product.slug}` : "#"),
      logoUrl: s.customLogoUrl || s.product?.logoUrl || null,
    };
  });

  slotsServerCache.set(cacheKey, { timestamp: Date.now(), data });
  return data;
}
