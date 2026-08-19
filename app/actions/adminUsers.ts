"use server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AdminUserData = {
  id: string;
  name: string;
  username: string;
  handle: string;
  email: string;
  role: "MAKER" | "MODERATOR" | "ADMIN";
  title?: string | null;
  bio?: string | null;
  image?: string | null;
  websiteUrl?: string | null;
  twitterHandle?: string | null;
  githubHandle?: string | null;
  emailVerified: boolean;
  isProfilePublic: boolean;
  showRevenuePublic: boolean;
  productCount: number;
  voteCount: number;
  commentCount: number;
  submissionCount: number;
  createdAt: string;
};

/**
 * Fetch all users with deep metrics and status for admin console
 */
export async function getAdminUsersAction(): Promise<AdminUserData[]> {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      title: true,
      bio: true,
      image: true,
      websiteUrl: true,
      twitterHandle: true,
      githubHandle: true,
      emailVerified: true,
      isProfilePublic: true,
      showRevenuePublic: true,
      createdAt: true,
      _count: {
        select: {
          products: true,
          votes: true,
          comments: true,
          submissions: true,
        },
      },
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name || u.username,
    username: u.username,
    handle: `@${u.username}`,
    email: u.email,
    role: u.role as "MAKER" | "MODERATOR" | "ADMIN",
    title: u.title,
    bio: u.bio,
    image: u.image,
    websiteUrl: u.websiteUrl,
    twitterHandle: u.twitterHandle,
    githubHandle: u.githubHandle,
    emailVerified: u.emailVerified,
    isProfilePublic: u.isProfilePublic,
    showRevenuePublic: u.showRevenuePublic,
    productCount: u._count.products,
    voteCount: u._count.votes,
    commentCount: u._count.comments,
    submissionCount: u._count.submissions,
    createdAt: u.createdAt.toISOString(),
  }));
}

/**
 * Update user role
 */
export async function updateUserRoleAction(
  userId: string,
  role: "MAKER" | "MODERATOR" | "ADMIN"
): Promise<{ success: boolean }> {
  await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Full profile edit by admin
 */
export async function updateUserProfileAdminAction(
  userId: string,
  data: {
    name?: string;
    username?: string;
    email?: string;
    title?: string;
    bio?: string;
    websiteUrl?: string;
    twitterHandle?: string;
    githubHandle?: string;
    role?: "MAKER" | "MODERATOR" | "ADMIN";
    emailVerified?: boolean;
    isProfilePublic?: boolean;
    showRevenuePublic?: boolean;
  }
): Promise<{ success: boolean }> {
  await requireAdmin();

  const updatePayload: any = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.username !== undefined) {
    const cleanUser = data.username.trim().toLowerCase().replace(/^@/, "");
    if (cleanUser) updatePayload.username = cleanUser;
  }
  if (data.email !== undefined) {
    const cleanEmail = data.email.trim().toLowerCase();
    if (cleanEmail) updatePayload.email = cleanEmail;
  }
  if (data.title !== undefined) updatePayload.title = data.title.trim() || null;
  if (data.bio !== undefined) updatePayload.bio = data.bio.trim() || null;
  if (data.websiteUrl !== undefined) updatePayload.websiteUrl = data.websiteUrl.trim() || null;
  if (data.twitterHandle !== undefined) updatePayload.twitterHandle = data.twitterHandle.trim().replace(/^@/, "") || null;
  if (data.githubHandle !== undefined) updatePayload.githubHandle = data.githubHandle.trim().replace(/^@/, "") || null;
  if (data.role !== undefined) updatePayload.role = data.role;
  if (data.emailVerified !== undefined) updatePayload.emailVerified = data.emailVerified;
  if (data.isProfilePublic !== undefined) updatePayload.isProfilePublic = data.isProfilePublic;
  if (data.showRevenuePublic !== undefined) updatePayload.showRevenuePublic = data.showRevenuePublic;

  await prisma.user.update({
    where: { id: userId },
    data: updatePayload,
  });

  revalidatePath("/admin");
  revalidatePath("/founders");
  return { success: true };
}

/**
 * Create a new user account directly by admin
 */
export async function createUserAdminAction(data: {
  name: string;
  username: string;
  email: string;
  title?: string;
  bio?: string;
  role?: "MAKER" | "MODERATOR" | "ADMIN";
  emailVerified?: boolean;
  isProfilePublic?: boolean;
  showRevenuePublic?: boolean;
  websiteUrl?: string;
  twitterHandle?: string;
  githubHandle?: string;
}): Promise<{ success: boolean; user?: any; error?: string }> {
  await requireAdmin();

  const cleanUsername = data.username.trim().toLowerCase().replace(/^@/, "");
  const cleanEmail = data.email.trim().toLowerCase();

  if (!cleanUsername || !cleanEmail) {
    return { success: false, error: "Username and email are required." };
  }

  // Check unique collision
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: cleanUsername }, { email: cleanEmail }],
    },
  });

  if (existing) {
    return {
      success: false,
      error: existing.username === cleanUsername ? "Username already taken." : "Email already registered.",
    };
  }

  const newUser = await prisma.user.create({
    data: {
      name: data.name.trim() || cleanUsername,
      username: cleanUsername,
      email: cleanEmail,
      title: data.title?.trim() || null,
      bio: data.bio?.trim() || null,
      role: data.role || "MAKER",
      emailVerified: data.emailVerified ?? true,
      isProfilePublic: data.isProfilePublic ?? true,
      showRevenuePublic: data.showRevenuePublic ?? false,
      websiteUrl: data.websiteUrl?.trim() || null,
      twitterHandle: data.twitterHandle?.trim().replace(/^@/, "") || null,
      githubHandle: data.githubHandle?.trim().replace(/^@/, "") || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/founders");
  return { success: true, user: newUser };
}

/**
 * Delete a user and clean up / reassign dependencies
 */
export async function deleteUserAdminAction(
  userId: string,
  options?: { confirmDestructive?: boolean }
): Promise<{
  success: boolean;
  error?: string;
  summary?: { productsToDelete: number; votes: number; comments: number; needsConfirmation?: boolean };
}> {
  const currentAdmin = await requireAdmin();
  if (currentAdmin.id === userId) {
    return { success: false, error: "You cannot delete your own active admin account." };
  }

  // Product.ownerId has onDelete: Cascade — deleting a user silently wipes
  // every product they've ever launched (and via further cascades, every
  // vote/comment/slot/purchase). Compute a summary first and require an
  // explicit confirmation flag if the delete would destroy any products.
  const [productsCount, votes, comments, productIds] = await Promise.all([
    prisma.product.count({ where: { ownerId: userId } }),
    prisma.vote.findMany({ where: { userId }, select: { productId: true } }),
    prisma.comment.findMany({ where: { userId }, select: { productId: true } }),
    prisma.product.findMany({ where: { ownerId: userId }, select: { id: true } }),
  ]);

  const summary = {
    productsToDelete: productsCount,
    votes: votes.length,
    comments: comments.length,
  };

  if (productsCount > 0 && !options?.confirmDestructive) {
    return {
      success: false,
      error: `This user owns ${productsCount} product(s). Their products, and every vote/comment/slot/purchase on those products, will be deleted. Re-call with confirmDestructive: true to proceed.`,
      summary: { ...summary, needsConfirmation: true },
    };
  }

  // Products that the departing user voted on / commented on — but that they
  // do NOT own — need their denormalized voteCount / commentCount decremented
  // to match reality after the delete.
  const ownedIds = new Set(productIds.map((p) => p.id));
  const otherVotes = votes.filter((v) => !ownedIds.has(v.productId)).map((v) => v.productId);
  const otherComments = comments.filter((c) => !ownedIds.has(c.productId)).map((c) => c.productId);

  const voteDelta = otherVotes.reduce<Map<string, number>>((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map());
  const commentDelta = otherComments.reduce<Map<string, number>>((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map());

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.vote.deleteMany({ where: { userId } }),
    prisma.comment.deleteMany({ where: { userId } }),
    // Fix denormalized counters on the surviving products.
    ...Array.from(voteDelta.entries()).map(([id, delta]) =>
      prisma.product.update({ where: { id }, data: { voteCount: { decrement: delta } } })
    ),
    ...Array.from(commentDelta.entries()).map(([id, delta]) =>
      prisma.product.update({ where: { id }, data: { commentCount: { decrement: delta } } })
    ),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/founders");
  return { success: true, summary };
}
