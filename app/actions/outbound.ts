"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getVisitorStats, type VisitorStats } from "@/lib/outbound/stats";

const Input = z.array(z.string().min(1).max(64)).max(200).optional();

/**
 * "Visitors sent" for the signed-in maker's own products. Only products the
 * caller owns are ever read: requested ids are intersected with ownership,
 * so passing someone else's product id simply returns nothing for it.
 */
export async function getMyVisitorStats(
  productIds?: string[]
): Promise<{ ok: true; stats: Record<string, VisitorStats> } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };
  const parsed = Input.safeParse(productIds);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const owned = await prisma.product.findMany({
    where: {
      ownerId: user.id,
      status: { not: "ARCHIVED" },
      ...(parsed.data ? { id: { in: parsed.data } } : {}),
    },
    select: { id: true },
  });
  try {
    return { ok: true, stats: await getVisitorStats(owned.map((p) => p.id)) };
  } catch (err) {
    console.error("[outbound] stats failed:", err);
    return { ok: false, error: "UNAVAILABLE" };
  }
}
