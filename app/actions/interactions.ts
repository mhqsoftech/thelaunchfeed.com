"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Vote and bookmark ("save") persistence.
 *
 * Both actions are toggles — calling with the same productId either casts
 * or retracts. Vote uses the Vote table (with a unique(productId,userId)
 * constraint); bookmark uses the User.savedProductIds inline array.
 */

import { invalidateFeedCache } from "@/lib/queries/products";
import { invalidateUserSessionCache } from "@/lib/auth";

async function assertLiveProduct(productId: string) {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true, slug: true },
  });
  if (!p) throw new Error("PRODUCT_NOT_FOUND");
  if (p.status !== "LIVE") throw new Error("PRODUCT_NOT_LIVE");
  return p;
}

export async function toggleVote(productId: string): Promise<{ voted: boolean; voteCount: number }> {
  const user = await requireUser();
  const product = await assertLiveProduct(productId);

  const existing = await prisma.vote.findUnique({
    where: { productId_userId: { productId, userId: user.id } },
  });

  let voted: boolean;
  let voteCount = 0;

  if (existing) {
    const [, updated] = await prisma.$transaction([
      prisma.vote.delete({ where: { id: existing.id } }),
      prisma.product.update({
        where: { id: productId },
        data: { voteCount: { decrement: 1 } },
        select: { voteCount: true },
      }),
    ]);
    voted = false;
    voteCount = updated.voteCount;
  } else {
    const [, updated] = await prisma.$transaction([
      prisma.vote.create({ data: { productId, userId: user.id } }),
      prisma.product.update({
        where: { id: productId },
        data: { voteCount: { increment: 1 } },
        select: { voteCount: true },
      }),
    ]);
    voted = true;
    voteCount = updated.voteCount;
  }

  invalidateFeedCache();
  invalidateUserSessionCache(user.id);
  revalidatePath(`/product/${product.slug}`);
  return { voted, voteCount };
}

export async function toggleBookmark(productId: string): Promise<{ saved: boolean }> {
  const user = await requireUser();
  await assertLiveProduct(productId);

  const current = new Set(user.savedProductIds ?? []);
  let saved: boolean;
  if (current.has(productId)) {
    current.delete(productId);
    saved = false;
  } else {
    current.add(productId);
    saved = true;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { savedProductIds: Array.from(current) },
  });

  revalidatePath("/profile");
  return { saved };
}

export type InteractionProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  votes: number;
  maker: string;
  makerName: string;
};

/** Hydrate a set of product ids into UI-friendly rows for the Saved tab. */
export async function listProductsByIds(ids: string[]): Promise<InteractionProduct[]> {
  if (!ids.length) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      voteCount: true,
      owner: { select: { username: true, name: true } },
      category: { select: { slug: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is (typeof rows)[number] => !!r)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      category: r.category?.slug ?? "uncategorized",
      votes: r.voteCount,
      maker: `@${r.owner.username}`,
      makerName: r.owner.name || r.owner.username,
    }));
}

/** Batch hydrate saved and upvoted products in a single database query */
export async function batchHydrateSavedAndUpvoted(
  savedIds: string[],
  upvotedIds: string[]
): Promise<{ saved: InteractionProduct[]; upvoted: InteractionProduct[] }> {
  const allIds = Array.from(new Set([...savedIds, ...upvotedIds]));
  if (!allIds.length) return { saved: [], upvoted: [] };

  const rows = await prisma.product.findMany({
    where: { id: { in: allIds } },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      voteCount: true,
      owner: { select: { username: true, name: true } },
      category: { select: { slug: true } },
    },
  });

  const byId = new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        slug: r.slug,
        name: r.name,
        tagline: r.tagline,
        category: r.category?.slug ?? "uncategorized",
        votes: r.voteCount,
        maker: `@${r.owner.username}`,
        makerName: r.owner.name || r.owner.username,
      },
    ])
  );

  return {
    saved: savedIds.map((id) => byId.get(id)).filter((p): p is InteractionProduct => !!p),
    upvoted: upvotedIds.map((id) => byId.get(id)).filter((p): p is InteractionProduct => !!p),
  };
}

export async function listMyInteractions(): Promise<{
  upvotedProductIds: string[];
  savedProductIds: string[];
}> {
  const user = await requireUser();
  const votes = await prisma.vote.findMany({
    where: { userId: user.id },
    select: { productId: true },
  });
  return {
    upvotedProductIds: votes.map((v) => v.productId),
    savedProductIds: user.savedProductIds ?? [],
  };
}
