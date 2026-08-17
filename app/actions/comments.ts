"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import type { Comment } from "@prisma/client";

const PostSchema = z.object({
  productSlug: z.string().min(1),
  body: z.string().min(1).max(4000),
  parentId: z.string().optional(),
});

const commentsCache = new Map<string, { data: any[]; timestamp: number }>();
const COMMENTS_CACHE_TTL_MS = 60_000; // 60s

export async function invalidateCommentsCache(slug?: string) {
  if (slug) {
    commentsCache.delete(slug.toLowerCase().trim());
  } else {
    commentsCache.clear();
  }
}

export async function listCommentsForSlug(productSlug: string): Promise<
  Array<
    Comment & {
      userName: string;
      userHandle: string;
      userEmail: string;
      userImage: string | null;
      isFounder: boolean;
    }
  >
> {
  const normSlug = productSlug.toLowerCase().trim();
  const cached = commentsCache.get(normSlug);
  if (cached && Date.now() - cached.timestamp < COMMENTS_CACHE_TTL_MS) {
    return cached.data;
  }

  const product = await prisma.product.findUnique({
    where: { slug: normSlug },
    select: {
      ownerId: true,
      owner: { select: { id: true, username: true } },
      makers: { select: { userId: true } },
    },
  });

  const founderIds = new Set<string>();
  if (product) {
    if (product.ownerId) founderIds.add(product.ownerId);
    if (product.owner?.id) founderIds.add(product.owner.id);
    for (const m of product.makers || []) {
      if (m.userId) founderIds.add(m.userId);
    }
  }

  const rows = await prisma.comment.findMany({
    where: {
      product: { slug: normSlug },
      isDeleted: false,
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          image: true,
        },
      },
    },
  });

  const result = rows.map((r) => ({
    ...r,
    userName: r.user.name || r.user.username,
    userHandle: `@${r.user.username}`,
    userEmail: r.user.email,
    userImage: r.user.image,
    isFounder: founderIds.has(r.userId) || founderIds.has(r.user.id),
  }));

  commentsCache.set(normSlug, { data: result, timestamp: Date.now() });
  return result;
}

export async function postComment(input: z.infer<typeof PostSchema>): Promise<Comment> {
  const user = await requireUser();
  const parsed = PostSchema.parse(input);
  const product = await prisma.product.findUnique({
    where: { slug: parsed.productSlug },
    select: { id: true },
  });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  const comment = await prisma.comment.create({
    data: {
      productId: product.id,
      userId: user.id,
      body: parsed.body.trim(),
      parentId: parsed.parentId,
    },
  });

  await prisma.product.update({
    where: { id: product.id },
    data: { commentCount: { increment: 1 } },
  });

  try {
    const { inngest } = await import("@/lib/inngest");
    await inngest.send({
      name: "comment.posted",
      data: { commentId: comment.id, productId: product.id },
    });
  } catch {}

  invalidateCommentsCache(parsed.productSlug);
  revalidatePath(`/product/${parsed.productSlug}`);
  return comment;
}

export async function reportComment(commentId: string, reason?: string): Promise<void> {
  const user = await requireUser();
  // upsert flag row so we don't double-count per reporter
  await prisma.$transaction([
    prisma.commentFlag.upsert({
      where: { commentId_raisedById: { commentId, raisedById: user.id } },
      create: { commentId, raisedById: user.id, reason },
      update: { reason },
    }),
    prisma.comment.update({
      where: { id: commentId },
      data: { isFlagged: true },
    }),
  ]);
  revalidatePath("/admin");
}

/* ─────────── moderation ─────────── */

export async function listFlaggedComments() {
  await requireAdmin();
  return prisma.comment.findMany({
    where: { isFlagged: true, isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, username: true, email: true } },
      product: { select: { slug: true, name: true } },
      flags: {
        include: { raisedBy: { select: { email: true, username: true } } },
      },
    },
  });
}

export async function dismissFlags(commentId: string): Promise<void> {
  await requireAdmin();
  await prisma.$transaction([
    prisma.commentFlag.updateMany({
      where: { commentId, resolvedAt: null },
      data: { resolvedAt: new Date(), resolution: "DISMISSED" },
    }),
    prisma.comment.update({
      where: { id: commentId },
      data: { isFlagged: false },
    }),
  ]);
  revalidatePath("/admin");
}

export async function deleteFlaggedComment(commentId: string): Promise<void> {
  await requireAdmin();
  const c = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { productId: true, product: { select: { slug: true } } },
  });
  await prisma.$transaction([
    prisma.commentFlag.updateMany({
      where: { commentId, resolvedAt: null },
      data: { resolvedAt: new Date(), resolution: "DELETED" },
    }),
    prisma.comment.update({
      where: { id: commentId },
      data: { isDeleted: true, isFlagged: false },
    }),
    ...(c?.productId
      ? [
          prisma.product.update({
            where: { id: c.productId },
            data: { commentCount: { decrement: 1 } },
          }),
        ]
      : []),
  ]);
  if (c?.product?.slug) {
    invalidateCommentsCache(c.product.slug);
    revalidatePath(`/product/${c.product.slug}`);
  }
  revalidatePath("/admin");
}
