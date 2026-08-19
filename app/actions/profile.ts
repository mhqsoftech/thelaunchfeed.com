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

  // Automated Web Search Indexing (Google Indexing API & IndexNow)
  try {
    const { submitBatch } = await import("@/lib/indexing");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
    await submitBatch([
      `${appUrl}/founder/${encodeURIComponent(updated.username.replace(/^@/, "").trim())}`,
      `${appUrl}/founders`,
    ]);
  } catch (err) {
    console.error("[web-indexing] failed for profile update:", err);
  }

  return updated;
}

/**
 * Change the caller's public handle. A username can be updated freely as long
 * as (a) it satisfies the format rules and (b) nobody currently holds it AND
 * nobody has ever held it before (via UsernameRedirect). The old handle is
 * recorded so /founder/<old> continues to serve as a permanent redirect to the
 * new one — inbound links from social, embeds, and search never break.
 *
 * Errors surface a stable code so the client can render a specific message
 * without depending on the wording:
 *  - USERNAME_INVALID
 *  - USERNAME_TAKEN
 *  - USERNAME_UNCHANGED
 */

// Reserved words the platform uses in routes/subpaths — a founder can't
// squat on these even if the User table is technically empty of them.
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "api", "app", "assets", "auth", "billing", "blog",
  "category", "checkout", "comments", "contact", "dashboard", "docs",
  "founder", "founders", "handler", "help", "legal", "login", "logout",
  "me", "moderator", "moderators", "new", "notifications", "onboarding",
  "pricing", "privacy", "product", "products", "profile", "public",
  "root", "search", "settings", "signin", "signout", "signup", "sitemap",
  "static", "submit", "support", "system", "team", "terms", "test",
  "thelaunchfeed", "user", "users", "verify", "webhook", "webhooks",
  "www",
]);

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$/;

function normalizeUsername(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase();
}

/**
 * Read-only availability check used by the settings UI before a rename.
 * Runs the same rules as updateUsername but never writes — the client uses
 * it to gate the "Update Handle" button so the user gets an explicit go/no-go
 * before they commit. Returns a stable status string so the caller can render
 * a specific message without parsing prose.
 */
export type UsernameAvailability =
  | { username: string; status: "available" }
  | { username: string; status: "unchanged" }
  | { username: string; status: "invalid"; reason: string }
  | { username: string; status: "taken"; reason: string };

export async function checkUsernameAvailability(
  rawUsername: string,
): Promise<UsernameAvailability> {
  const user = await requireUser();
  const next = normalizeUsername(rawUsername);

  if (!USERNAME_RE.test(next) || RESERVED_USERNAMES.has(next)) {
    return {
      username: next,
      status: "invalid",
      reason:
        "Use 3–30 lowercase letters, digits, - or _ (not at the ends). Reserved words aren't allowed.",
    };
  }

  if (next === user.username.toLowerCase()) {
    return { username: next, status: "unchanged" };
  }

  const [clashUser, clashRedirect] = await Promise.all([
    prisma.user.findFirst({
      where: {
        username: { equals: next, mode: "insensitive" },
        NOT: { id: user.id },
      },
      select: { id: true },
    }),
    prisma.usernameRedirect.findFirst({
      where: {
        oldUsername: { equals: next, mode: "insensitive" },
        NOT: { userId: user.id },
      },
      select: { id: true },
    }),
  ]);

  if (clashUser || clashRedirect) {
    return {
      username: next,
      status: "taken",
      reason: `"${next}" is already in use.`,
    };
  }

  return { username: next, status: "available" };
}

export async function updateUsername(rawUsername: string): Promise<{
  username: string;
  previousUsername: string;
}> {
  const user = await requireUser();
  const next = normalizeUsername(rawUsername);

  if (!USERNAME_RE.test(next) || RESERVED_USERNAMES.has(next)) {
    const err = new Error(
      "USERNAME_INVALID: Use 3–30 chars, lowercase letters/digits with - or _ (not at the ends), and not a reserved word.",
    );
    throw err;
  }

  const current = user.username.toLowerCase();
  if (next === current) {
    throw new Error("USERNAME_UNCHANGED: That is already your handle.");
  }

  // Uniqueness must ignore case AND account for every historical handle,
  // otherwise recycling an old username of another founder would silently
  // hijack any redirect they had in place.
  const [clashUser, clashRedirect] = await Promise.all([
    prisma.user.findFirst({
      where: {
        username: { equals: next, mode: "insensitive" },
        NOT: { id: user.id },
      },
      select: { id: true },
    }),
    prisma.usernameRedirect.findFirst({
      where: {
        oldUsername: { equals: next, mode: "insensitive" },
        NOT: { userId: user.id },
      },
      select: { id: true },
    }),
  ]);
  if (clashUser || clashRedirect) {
    throw new Error(`USERNAME_TAKEN: "${next}" is already in use.`);
  }

  const previous = user.username;

  await prisma.$transaction(async (tx) => {
    // Free the redirect row that may be pointing at `next` if the caller
    // previously used and abandoned it — they own it and are re-taking it.
    await tx.usernameRedirect.deleteMany({
      where: {
        userId: user.id,
        oldUsername: { equals: next, mode: "insensitive" },
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { username: next },
    });

    // Record the vacated handle so /founder/<previous> keeps resolving.
    // upsert covers the case where `previous` is already in the table from
    // an earlier rename — its userId is the same, so nothing changes.
    await tx.usernameRedirect.upsert({
      where: { oldUsername: previous },
      create: { oldUsername: previous, userId: user.id },
      update: { userId: user.id },
    });
  });

  const { invalidateProfileCache } = await import("@/lib/queries/user");
  invalidateProfileCache();

  revalidatePath("/profile");
  revalidatePath(`/founder/${previous}`);
  revalidatePath(`/founder/${next}`);
  revalidatePath("/founders");

  return { username: next, previousUsername: previous };
}

/**
 * Products the signed-in user has actually launched. Returns [] when they
 * haven't published anything — the profile page must render an empty state
 * in that case, never fake placeholders.
 */
export type MyProductStatus = "LIVE" | "SCHEDULED" | "REJECTED" | "DRAFT";

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
      where: { ownerId: user.id, status: { in: ["SCHEDULED", "REJECTED", "DRAFT"] } },
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
    status:
      s.status === "REJECTED"
        ? "REJECTED"
        : s.status === "DRAFT"
          ? "DRAFT"
          : "SCHEDULED",
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
