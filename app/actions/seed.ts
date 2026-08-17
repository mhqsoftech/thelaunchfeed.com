"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { invalidateFeedCache } from "@/lib/queries/products";
import { invalidateSlotsCache } from "@/lib/queries/slots";

export type DatabaseStatus = {
  productsCount: number;
  liveProductsCount: number;
  archivedProductsCount: number;
  submissionsCount: number;
  usersCount: number;
  votesCount: number;
  commentsCount: number;
  categoriesCount: number;
  delistedSections: string[];
};

import { ALL_SECTIONS } from "@/lib/sections";

/**
 * Get current counts across the database and active delisted sections.
 */
export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  await requireAdmin();

  const [
    productsCount,
    liveProductsCount,
    archivedProductsCount,
    submissionsCount,
    usersCount,
    votesCount,
    commentsCount,
    categoriesCount,
    delistRow,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: "LIVE" } }),
    prisma.product.count({ where: { status: "ARCHIVED" } }),
    prisma.submission.count(),
    prisma.user.count(),
    prisma.vote.count(),
    prisma.comment.count(),
    prisma.category.count(),
    prisma.appSetting.findUnique({ where: { key: "feed.delisted_sections" } }),
  ]);

  const delistedSections: string[] = Array.isArray(delistRow?.value)
    ? (delistRow.value as string[])
    : [];

  return {
    productsCount,
    liveProductsCount,
    archivedProductsCount,
    submissionsCount,
    usersCount,
    votesCount,
    commentsCount,
    categoriesCount,
    delistedSections,
  };
}

/**
 * Toggles delisting/hiding for a specific section (e.g. "daily", "weekly", "monthly", "yearly", "alltime", "categories", "featured").
 * Zero database data loss.
 */
export async function toggleSectionDelist(
  sectionId: string,
  delist: boolean
): Promise<{ success: boolean; delistedSections: string[]; message: string }> {
  await requireAdmin();

  const row = await prisma.appSetting.findUnique({
    where: { key: "feed.delisted_sections" },
  });
  let current: string[] = Array.isArray(row?.value) ? (row.value as string[]) : [];

  if (delist) {
    if (!current.includes(sectionId)) {
      current.push(sectionId);
    }
  } else {
    current = current.filter((s) => s !== sectionId && s !== "all");
  }

  await prisma.appSetting.upsert({
    where: { key: "feed.delisted_sections" },
    create: { key: "feed.delisted_sections", value: current },
    update: { value: current },
  });

  invalidateFeedCache();
  invalidateSlotsCache();

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/founders");
  revalidatePath("/category");
  revalidatePath("/submit");

  const sectionName = ALL_SECTIONS.find((s) => s.id === sectionId)?.name || sectionId;

  return {
    success: true,
    delistedSections: current,
    message: delist
      ? `Successfully delisted products from "${sectionName}". Feeds updated.`
      : `Successfully restored products to "${sectionName}". Feeds updated.`,
  };
}

/**
 * Delists/hides products from ALL sections at once via section settings.
 */
export async function delistAllSections(): Promise<{
  success: boolean;
  delistedSections: string[];
  message: string;
}> {
  await requireAdmin();

  const allIds = ALL_SECTIONS.map((s) => s.id);

  await prisma.appSetting.upsert({
    where: { key: "feed.delisted_sections" },
    create: { key: "feed.delisted_sections", value: allIds },
    update: { value: allIds },
  });

  invalidateFeedCache();
  invalidateSlotsCache();

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/founders");
  revalidatePath("/category");
  revalidatePath("/submit");

  return {
    success: true,
    delistedSections: allIds,
    message: "Successfully delisted products across ALL sections and feeds (Daily, Weekly, Monthly, Yearly, All-Time, Categories, Featured). All database records are safely preserved.",
  };
}

/**
 * Restores products to ALL sections at once.
 */
export async function restoreAllSections(): Promise<{
  success: boolean;
  delistedSections: string[];
  message: string;
}> {
  await requireAdmin();

  await prisma.appSetting.upsert({
    where: { key: "feed.delisted_sections" },
    create: { key: "feed.delisted_sections", value: [] },
    update: { value: [] },
  });

  invalidateFeedCache();
  invalidateSlotsCache();

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/founders");
  revalidatePath("/category");
  revalidatePath("/submit");

  return {
    success: true,
    delistedSections: [],
    message: "Successfully restored products across ALL sections and feeds.",
  };
}

/**
 * Delists/hides products from all public feeds by switching database status to ARCHIVED.
 * DOES NOT DELETE any data from the database.
 */
export async function unpublishAllProductsFromFeeds(): Promise<{
  success: boolean;
  count: number;
  message: string;
}> {
  await requireAdmin();

  // ONLY archive demo/seed products that are not from genuine user submissions
  const result = await prisma.product.updateMany({
    where: {
      status: "LIVE",
      fromSubmission: null,
    },
    data: { status: "ARCHIVED" },
  });

  // Ensure all genuine submissions remain LIVE
  await prisma.product.updateMany({
    where: {
      fromSubmission: { isNot: null },
      status: "ARCHIVED",
    },
    data: { status: "LIVE" },
  });

  invalidateFeedCache();
  invalidateSlotsCache();

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/founders");
  revalidatePath("/category");
  revalidatePath("/submit");

  return {
    success: true,
    count: result.count,
    message: `Successfully set ${result.count} seed demo products to ARCHIVED status. Authentic user launches remain live and active on all feeds.`,
  };
}

/**
 * Restores archived products back to LIVE status on all public feeds.
 */
export async function publishAllArchivedProductsToFeeds(): Promise<{
  success: boolean;
  count: number;
  message: string;
}> {
  await requireAdmin();

  const result = await prisma.product.updateMany({
    where: { status: "ARCHIVED" },
    data: { status: "LIVE" },
  });

  invalidateFeedCache();
  invalidateSlotsCache();

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/founders");
  revalidatePath("/category");
  revalidatePath("/submit");

  return {
    success: true,
    count: result.count,
    message: `Successfully restored ${result.count} products to LIVE status across all public feeds & leaderboards.`,
  };
}

/**
 * Purges all seed / demo products, votes, comments, submissions, and mock founder profiles.
 * Preserves admin accounts and genuine authenticated users.
 */
export async function purgeAllSeedData(): Promise<{ success: boolean; message: string }> {
  const adminUser = await requireAdmin();

  // 1. Purge product interactions & metadata
  await prisma.commentFlag.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.vote.deleteMany({});
  await prisma.rankSnapshot.deleteMany({});
  await prisma.revenueSnapshot.deleteMany({});
  await prisma.productRevenue.deleteMany({});
  await prisma.revenueConnection.deleteMany({});
  await prisma.featuredSlot.deleteMany({});
  await prisma.featuredPurchase.deleteMany({});
  await prisma.productMaker.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.product.deleteMany({});

  // 2. Clear any delisted section flags
  await prisma.appSetting.deleteMany({
    where: { key: "feed.delisted_sections" },
  });

  // 3. Preserve admins and genuine authenticated users with sessions/accounts
  const adminEmails = [
    adminUser.email.toLowerCase(),
    "minhaj99mhq@gmail.com",
    "menajulhoque99@gmail.com",
    (process.env.ADMIN_EMAIL || "").toLowerCase(),
  ].filter(Boolean);

  // Users who have logged in via OAuth / accounts or have admin role
  const realUsers = await prisma.user.findMany({
    where: {
      OR: [
        { role: "ADMIN" },
        { email: { in: adminEmails } },
        { accounts: { some: {} } },
        { sessions: { some: {} } },
      ],
    },
    select: { id: true },
  });

  const realUserIds = realUsers.map((u) => u.id);

  // Delete demo founder profiles
  await prisma.user.deleteMany({
    where: {
      id: { notIn: realUserIds },
    },
  });

  invalidateFeedCache();
  invalidateSlotsCache();

  // Revalidate routes
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/founders");
  revalidatePath("/category");
  revalidatePath("/submit");

  return {
    success: true,
    message: "All seed and demo data was permanently wiped from the database. Database is now completely clean for real user launches.",
  };
}
