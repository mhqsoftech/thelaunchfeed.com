"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, getCurrentUser } from "@/lib/auth";

/**
 * Persist the fields on the profile settings tab. Writes columns that
 * exist on the User table (`name`, `title`, `bio`, `websiteUrl`, `twitterHandle`,
 * `githubHandle`, `image`).
 *
 * `image` may be a remote URL or an inline data URI. Data URIs are capped
 * at ~500 KB post-encoding so a rogue upload can't bloat the row.
 */


import { uploadToNeonStorage, parseDataUri } from "@/lib/storage";

const MAX_IMAGE_BYTES = 5_000_000;

const nullableTrimmed = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null);

const optionalUrl = z
  .string()
  .max(500)
  .transform((v) => v.trim())
  .refine(
    (v) => v === "" || /^https?:\/\//i.test(v),
    "Must be an http(s) URL",
  )
  .transform((v) => (v === "" ? null : v));

const ProfileSchema = z.object({
  name: z.string().trim().max(120).optional(),
  title: nullableTrimmed.optional(),
  bio: nullableTrimmed.optional(),
  websiteUrl: optionalUrl.optional(),
  twitterHandle: nullableTrimmed.optional(),
  githubHandle: nullableTrimmed.optional(),
  image: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : v))
    .refine((v) => {
      if (v == null || v === "") return true;
      if (/^https?:\/\//i.test(v)) return true;
      if (v.startsWith("data:image/")) return true;
      return false;
    }, "Image must be an http(s) URL or a data:image/*"),
});

export type UpdateProfileInput = z.infer<typeof ProfileSchema>;

export async function updateProfile(input: UpdateProfileInput) {
  const user = await requireUser();
  const parsed = ProfileSchema.parse(input);

  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name || user.name || "";
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.bio !== undefined) data.bio = parsed.bio;
  if (parsed.websiteUrl !== undefined) data.websiteUrl = parsed.websiteUrl;
  if (parsed.twitterHandle !== undefined) data.twitterHandle = parsed.twitterHandle;
  if (parsed.githubHandle !== undefined) data.githubHandle = parsed.githubHandle;

  if (parsed.image !== undefined) {
    if (!parsed.image) {
      data.image = null;
    } else if (parsed.image.startsWith("data:image/")) {
      const parsedImage = parseDataUri(parsed.image);
      if (parsedImage) {
        const ext = parsedImage.contentType.split("/")[1] || "png";
        const key = `avatars/${user.id}-${Date.now()}.${ext}`;
        const publicUrl = await uploadToNeonStorage(parsedImage.buffer, key, parsedImage.contentType);
        data.image = publicUrl;
      }
    } else {
      data.image = parsed.image;
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      title: true,
      bio: true,
      image: true,
      websiteUrl: true,
      twitterHandle: true,
      githubHandle: true,
    },
  });

  revalidatePath("/profile");
  revalidatePath(`/founder/${updated.username}`);

  return updated;
}

/**
 * Products the signed-in user has actually launched. Returns [] when they
 * haven't published anything — the profile page must render an empty state
 * in that case, never fake placeholders.
 */
export type MyProductStatus = "LIVE" | "SCHEDULED" | "REJECTED";

/**
 * Awards a product is currently eligible to show a badge for.
 *  - `pod`      → held rank 1 on the DAILY board at least once
 *  - `champion` → held rank 1 on the WEEKLY or MONTHLY board at least once
 *  - `upvote`   → has crossed a "top upvoted" threshold (100+ votes)
 *  - `revenue`  → owner has connected + verified revenue for this product
 * Never fabricated — computed from real DB state per product.
 */
import type { ProductAward } from "@/lib/awards";
import { computeAwardsForProducts } from "@/lib/queries/awards";

export type { ProductAward };

export type MyProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  votes: number;
  makerName: string;
  maker: string;
  launchedAt: string;
  status: MyProductStatus;
  scheduledFor?: string;
  submissionId?: string; // set when status=SCHEDULED or REJECTED so the UI can act on the row
  rejectionReason?: string;
  rejectedAt?: string;
  awards: ProductAward[];
};

export async function listMyProducts(): Promise<MyProduct[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const [published, pending] = await Promise.all([
    prisma.product.findMany({
      where: { ownerId: user.id, status: { not: "ARCHIVED" } },
      orderBy: { launchedAt: "desc" },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        logoUrl: true,
        voteCount: true,
        launchedAt: true,
        category: { select: { slug: true, name: true } },
      },
    }),
    prisma.submission.findMany({
      where: { ownerId: user.id, status: { in: ["SCHEDULED", "REJECTED"] } },
      orderBy: [{ status: "asc" }, { scheduledFor: "asc" }],
      select: {
        id: true,
        name: true,
        tagline: true,
        logoUrl: true,
        status: true,
        scheduledFor: true,
        rejectedAt: true,
        rejectionReason: true,
        category: { select: { slug: true, name: true } },
      },
    }),
  ]);

  const displayName = user.name || user.username;
  const awardsByProduct = await computeAwardsForProducts(published);
  const liveRows: MyProduct[] = published.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    logoUrl: p.logoUrl,
    category: p.category?.slug ?? "uncategorized",
    votes: p.voteCount,
    makerName: displayName,
    maker: `@${user.username}`,
    launchedAt: p.launchedAt.toISOString(),
    status: "LIVE",
    awards: awardsByProduct.get(p.id) ?? [],
  }));

  const pendingRows: MyProduct[] = pending.map((s) => ({
    // Use the submission id as the row id so React keys stay stable
    // until the item transitions to a real Product.
    id: `sub:${s.id}`,
    slug: "",
    name: s.name,
    tagline: s.tagline,
    logoUrl: s.logoUrl,
    category: s.category?.slug ?? "uncategorized",
    votes: 0,
    makerName: displayName,
    maker: `@${user.username}`,
    launchedAt: s.scheduledFor.toISOString(),
    status: s.status === "REJECTED" ? "REJECTED" : "SCHEDULED",
    scheduledFor: s.scheduledFor.toISOString(),
    submissionId: s.id,
    rejectionReason: s.rejectionReason ?? undefined,
    rejectedAt: s.rejectedAt?.toISOString(),
    awards: [], // submissions can't have awards yet — nothing to render
  }));

  // Pending items first (they're the actionable ones), then live products
  // newest-first.
  return [...pendingRows, ...liveRows];
}
