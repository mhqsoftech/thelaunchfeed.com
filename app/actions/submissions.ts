"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import type { Submission, SubmissionStatus } from "@prisma/client";

import { getNext6AmIstRelease } from "@/lib/schedule";

/* ─────────── config ─────────── */

const LEAD_KEY = "submission.defaultLeadHours";

export async function getDefaultLeadHours(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: LEAD_KEY } });
  const v = row?.value;
  if (typeof v === "number" && v >= 0) return v;
  return 24;
}

export async function setDefaultLeadHours(hours: number): Promise<void> {
  await requireAdmin();
  if (!Number.isFinite(hours) || hours < 0) throw new Error("INVALID_LEAD");
  await prisma.appSetting.upsert({
    where: { key: LEAD_KEY },
    create: { key: LEAD_KEY, value: hours },
    update: { value: hours },
  });
  revalidatePath("/admin");
}

/* ─────────── create ─────────── */

import { uploadToNeonStorage, parseDataUri } from "@/lib/storage";

const imageString = z
  .string()
  .refine((v) => {
    if (!v) return true;
    if (/^https?:\/\//i.test(v)) return true;
    if (v.startsWith("data:image/")) return true;
    return false;
  }, "Image must be an http(s) URL or a data:image/*");

/**
 * Video URL validator — accepts any http(s) URL so founders can use YouTube,
 * Vimeo, Loom, Google Drive, X/Twitter, TikTok, Instagram, Streamable,
 * Dropbox, or a direct .mp4/.webm link. Auto-normalizes URLs without protocol
 * (e.g. youtube.com/... -> https://youtube.com/...).
 */
const videoUrlSchema = z
  .preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val !== "string") return undefined;
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }, z.string().optional())
  .refine(
    (v) => {
      if (!v) return true;
      try {
        const u = new URL(v);
        return (
          (u.protocol === "http:" || u.protocol === "https:") &&
          u.hostname.length >= 3 &&
          u.hostname.includes(".")
        );
      } catch {
        return false;
      }
    },
    { message: "videoUrl must be a valid http(s) URL" },
  );

/**
 * Tags normalizer — accepts string[] or comma-separated string,
 * sanitizes each tag (trims, lowercases, removes leading '#'),
 * and deduplicates.
 */
const tagsSchema = z
  .preprocess((val) => {
    if (val === null || val === undefined) return [];
    if (Array.isArray(val)) {
      return Array.from(
        new Set(
          val
            .map((t) => (typeof t === "string" ? t.trim().toLowerCase().replace(/^#+/, "") : ""))
            .filter((t) => t.length > 0 && t.length <= 60),
        ),
      ).slice(0, 30);
    }
    if (typeof val === "string") {
      return Array.from(
        new Set(
          val
            .split(",")
            .map((t) => t.trim().toLowerCase().replace(/^#+/, ""))
            .filter((t) => t.length > 0 && t.length <= 60),
        ),
      ).slice(0, 30);
    }
    return [];
  }, z.array(z.string().max(60)).max(30).optional())
  .default([]);

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  tagline: z.string().min(1).max(250).or(z.literal("")),
  websiteUrl: z.string().optional().or(z.literal("")),
  description: z.string().optional().nullable(),
  categorySlug: z.string().optional().nullable(),
  makerName: z.string().min(1),
  makerHandle: z.string().min(1),
  logoUrl: imageString.optional().or(z.literal("")).nullable(),
  screenshots: z.array(imageString).max(8).optional().nullable(),
  videoUrl: videoUrlSchema,
  tags: tagsSchema,
  details: z.record(z.string(), z.unknown()).optional().nullable(),
  asDraft: z.boolean().optional(),
});

export type CreateSubmissionInput = z.infer<typeof CreateSchema>;

async function processImageString(img: string | undefined | null, prefix: string): Promise<string | null> {
  if (!img) return null;
  if (img.startsWith("data:image/")) {
    const parsed = parseDataUri(img);
    if (parsed) {
      const ext = parsed.contentType.split("/")[1] || "png";
      const key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      try {
        return await uploadToNeonStorage(parsed.buffer, key, parsed.contentType);
      } catch (err) {
        console.error(`[processImageString] Failed to upload ${prefix}:`, err);
        throw new Error(`Failed to upload ${prefix} image. Please try again or use a smaller image.`);
      }
    }
  }
  return img;
}

function extractDomainAndPath(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  let clean = rawUrl.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.replace(/^www\./, "");

  // For app store URLs where query parameters define the unique application identity (e.g. Google Play ?id=...)
  try {
    const fullUrl = new URL(rawUrl.match(/^https?:\/\//i) ? rawUrl : `https://${rawUrl}`);
    if (fullUrl.hostname.includes("play.google.com") && fullUrl.searchParams.has("id")) {
      const appId = fullUrl.searchParams.get("id") || "";
      clean = `${fullUrl.hostname}${fullUrl.pathname}?id=${appId}`.replace(/^www\./, "").toLowerCase();
      return clean.replace(/\/+$/, "");
    }
  } catch {}

  clean = clean.split("?")[0].split("#")[0];
  clean = clean.replace(/\/+$/, "");
  return clean;
}

export async function resolveCategory(raw: string | undefined | null) {
  if (!raw || !raw.trim()) {
    return (
      (await prisma.category.findFirst({ where: { slug: "dev-tools" } })) ||
      (await prisma.category.findFirst())
    );
  }

  const trimmed = raw.trim();
  const slug = slugify(trimmed);

  // 1. Direct match by Category name (user's exact dropdown choice)
  let cat = await prisma.category.findFirst({
    where: {
      name: { equals: trimmed, mode: "insensitive" },
    },
  });
  if (cat) return cat;

  // 2. Direct match by Category slug
  cat = await prisma.category.findUnique({ where: { slug: trimmed.toLowerCase() } });
  if (cat) return cat;

  cat = await prisma.category.findUnique({ where: { slug } });
  if (cat) return cat;

  // 3. Known aliases
  const aliases: Record<string, string> = {
    devtools: "dev-tools",
    "developer-tools": "dev-tools",
    developer: "dev-tools",
    "ai-ml": "ai",
    ai: "ai",
    "ai-machine-learning": "ai",
    machinelearning: "ai",
    "machine-learning": "ai",
    mobile: "mobile",
    "mobile-apps": "mobile",
    opensource: "open-source",
    "open-source": "open-source",
    health: "health",
    "health-fitness": "health",
    fintech: "fintech",
    finance: "fintech",
    saas: "saas",
    productivity: "productivity",
    design: "design",
    education: "education",
  };

  const aliasSlug = aliases[slug] || aliases[trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "")];
  if (aliasSlug) {
    cat = await prisma.category.findUnique({ where: { slug: aliasSlug } });
    if (cat) return cat;
  }

  // 4. Case-insensitive substring match
  cat = await prisma.category.findFirst({
    where: {
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { slug: { contains: slug, mode: "insensitive" } },
      ],
    },
  });
  if (cat) return cat;

  // 5. Unknown category name — do NOT create one from user input, or the
  // taxonomy fills up with typos and spam ("Ai Tools", "aitools", ...).
  // Fall through to the default fallback below; admins can add real new
  // categories from the admin panel.
  try {
    return (
      (await prisma.category.findFirst({ where: { slug: "dev-tools" } })) ||
      (await prisma.category.findFirst())
    );
  } catch {
    return (
      (await prisma.category.findFirst({ where: { slug: "dev-tools" } })) ||
      (await prisma.category.findFirst())
    );
  }
}

export type SubmissionConflict = {
  type: "existing_product" | "existing_submission";
  productName: string;
  productSlug?: string;
  productUrl?: string;
  websiteUrl?: string;
};

export type CreateSubmissionResult =
  | { success: true; submission: Submission }
  | {
      success: false;
      error: string;
      conflict?: SubmissionConflict;
      freeGate?: import("@/lib/free-launch").FreeLaunchGate;
    };

export async function createSubmission(input: CreateSubmissionInput): Promise<CreateSubmissionResult> {
  try {
    const user = await requireUser();
    let parsed: CreateSubmissionInput;
    try {
      parsed = CreateSchema.parse(input);
    } catch (zodErr) {
      if (zodErr instanceof z.ZodError) {
        const firstIssue = zodErr.issues[0];
        const fieldName = firstIssue?.path?.join(".") || "field";
        return { success: false, error: `Invalid ${fieldName}: ${firstIssue?.message || "Validation failed"}` };
      }
      return { success: false, error: "Invalid submission data" };
    }

    const isDraft = parsed.asDraft === true;

    // A $5 / $10 launch is held as a DRAFT until checkout succeeds — it must
    // not reach the review queue (or send the "submitted" email) unpaid.
    const freeLaunch = await import("@/lib/free-launch");
    const clientDetails = freeLaunch.stripProtectedDetails(parsed.details as Record<string, unknown> | null);
    const tier = freeLaunch.requestedTier(clientDetails);
    const awaitingPayment = !isDraft && tier !== 0;

    // Idempotency: Prevent duplicate submissions if triggered twice in quick succession by same user
    const recentDuplicate = await prisma.submission.findFirst({
      where: {
        ownerId: user.id,
        name: { equals: parsed.name, mode: "insensitive" },
        status: isDraft || awaitingPayment ? "DRAFT" : "SCHEDULED",
        createdAt: { gte: new Date(Date.now() - 30_000) },
      },
    });
    if (recentDuplicate) {
      return { success: true, submission: recentDuplicate };
    }

    // Global Deduplication: Prevent any user from submitting a duplicate website URL or product name.
    // Drafts are private to the user, so skip the global dedup check for them —
    // multiple people can hold drafts of the same URL until one publishes.
    const rawUrl = parsed.websiteUrl || `https://${slugify(parsed.name)}.com`;
    const domain = extractDomainAndPath(rawUrl);

    if (!isDraft && domain && domain.length > 3) {
      // 1. Check if product is already LIVE or exists on platform
      const existingProduct = await prisma.product.findFirst({
        where: {
          status: { not: "ARCHIVED" },
          OR: [
            { websiteUrl: { contains: domain, mode: "insensitive" } },
            { slug: slugify(parsed.name) },
          ],
        },
        select: { id: true, name: true, websiteUrl: true, slug: true },
      });

      if (existingProduct) {
        const existingDomain = extractDomainAndPath(existingProduct.websiteUrl);
        if (existingDomain === domain || existingProduct.slug === slugify(parsed.name)) {
          return {
            success: false,
            error: `This product (${existingProduct.name} · ${domain}) has already been launched on The Launch Feed. Each product URL can only be submitted once.`,
            conflict: {
              type: "existing_product",
              productName: existingProduct.name,
              productSlug: existingProduct.slug,
              productUrl: `/product/${existingProduct.slug}`,
              websiteUrl: existingProduct.websiteUrl,
            },
          };
        }
      }

      // 2. Check if a submission is already queued by any user.
      // If the same user already has a matching SCHEDULED or DRAFT row for this
      // domain, treat this call as an idempotent resubmit and return the existing
      // row instead of throwing — the auto-submit-after-signin flow relies on this
      // when a user hits Submit twice or edits a queued launch from the profile.
      const existingSubmission = await prisma.submission.findFirst({
        where: {
          status: { in: ["SCHEDULED", "DRAFT"] },
          OR: [
            { websiteUrl: { contains: domain, mode: "insensitive" } },
            { name: { equals: parsed.name, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, websiteUrl: true, ownerId: true, status: true },
      });

      if (existingSubmission) {
        const existingSubDomain = extractDomainAndPath(existingSubmission.websiteUrl);
        const isMatch =
          existingSubDomain === domain ||
          existingSubmission.name.toLowerCase().trim() === parsed.name.toLowerCase().trim();
        if (isMatch) {
          if (existingSubmission.ownerId === user.id) {
            // Same user re-submitting their own draft (e.g. a launch held for
            // payment, now going free or paid again): submit that draft with
            // this form's content, so it gets the same free-gate / payment
            // handling as "edit → Launch Draft".
            if (existingSubmission.status === "DRAFT") {
              try {
                const row = await updateMySubmission(existingSubmission.id, {
                  name: parsed.name,
                  tagline: parsed.tagline,
                  description: parsed.description,
                  websiteUrl: parsed.websiteUrl,
                  categorySlug: parsed.categorySlug,
                  logoUrl: parsed.logoUrl,
                  screenshots: parsed.screenshots,
                  videoUrl: parsed.videoUrl,
                  tags: parsed.tags,
                  details: parsed.details as Record<string, unknown> | null,
                });
                return { success: true, submission: row };
              } catch (err) {
                return { success: false, error: err instanceof Error ? err.message : "Free launch requirements not met." };
              }
            }
            // Same user re-submitting a queued launch — return their existing row silently.
            const row = await prisma.submission.findUnique({ where: { id: existingSubmission.id } });
            if (row) return { success: true, submission: row };
          }
          // Do not leak the queued submission's name or owner — enumerating
          // this endpoint would otherwise reveal every draft/scheduled launch
          // by URL or product name.
          return {
            success: false,
            error: `A launch is already queued for ${domain}. Duplicate submissions are not permitted.`,
            conflict: {
              type: "existing_submission",
              productName: existingSubmission.name,
              websiteUrl: existingSubmission.websiteUrl,
            },
          };
        }
      }
    }

    const scheduledFor =
      isDraft || awaitingPayment ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : getNext6AmIstRelease();

    const category = await resolveCategory(parsed.categorySlug);

    const [logoUrl, uploadedScreenshots] = await Promise.all([
      processImageString(parsed.logoUrl, "logos"),
      parsed.screenshots
        ? Promise.all(parsed.screenshots.map((scr) => processImageString(scr, "screenshots")))
        : Promise.resolve<Array<string | null>>([]),
    ]);
    const screenshots: string[] = uploadedScreenshots.filter((s): s is string => !!s);

    // Free launches ($0) must show our badge and upvote other launches first.
    // Paid tiers are created as held drafts and go to checkout; a confirmed
    // payment (activatePlacementSlot) is what puts them in the queue.
    let freeStamp: Record<string, unknown> | undefined;
    if (!isDraft && tier === 0) {
      const gate = await freeLaunch.requireFreeGate(user.id, parsed.websiteUrl || "");
      if (!gate.qualified) {
        return { success: false, error: gate.message || "Free launch requirements not met.", freeGate: gate };
      }
      freeStamp = freeLaunch.freeLaunchStamp(gate);
    }

    const detailsData = {
      ...(clientDetails ?? {}),
      videoUrl: parsed.videoUrl || null,
      tags: parsed.tags ?? [],
      freeGateVersion: freeLaunch.FREE_GATE_VERSION,
      // Site keys the "Featured on" badge link resolves by (lib/free-launch).
      badgeKeys: freeLaunch.withBadgeKeys([], parsed.websiteUrl),
      ...(freeStamp ? { freeLaunch: freeStamp } : {}),
      ...(awaitingPayment ? { awaitingPayment: freeLaunch.awaitingPaymentStamp(tier) } : {}),
    };

    const sub = await prisma.submission.create({
      data: {
        ownerId: user.id,
        name: parsed.name,
        tagline: parsed.tagline,
        description: parsed.description,
        websiteUrl: parsed.websiteUrl || `https://${slugify(parsed.name)}.com`,
        logoUrl,
        screenshots,
        videoUrl: parsed.videoUrl || null,
        tags: parsed.tags ?? [],
        categoryId: category?.id,
        details: detailsData as any,
        makerName: parsed.makerName,
        makerHandle: parsed.makerHandle,
        makerEmail: user.email,
        status: isDraft || awaitingPayment ? "DRAFT" : "SCHEDULED",
        scheduledFor,
      },
    });

    if (isDraft) {
      return { success: true, submission: sub };
    }
    if (awaitingPayment) {
      try {
        revalidatePath("/profile");
      } catch {}
      return { success: true, submission: sub };
    }

    // Founder confirmation email runs as a durable background job.
    const { emit } = await import("@/lib/jobs");
    await emit("submission.created", { submissionId: sub.id });

    try {
      revalidatePath("/admin");
      revalidatePath("/submit");
      revalidatePath("/profile");
    } catch (e) {
      console.warn("[submission:revalidatePath] non-critical error:", e);
    }
    return { success: true, submission: sub };
  } catch (err) {
    console.error("[createSubmission] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to create submission. Please try again.";
    return { success: false, error: msg };
  }
}

/* ─────────── admin ─────────── */

export async function listSubmissions() {
  await requireAdmin();
  // Category + owner ride along so the admin preview can show the full
  // submission without a second round-trip.
  return prisma.submission.findMany({
    orderBy: [{ status: "asc" }, { scheduledFor: "asc" }],
    include: {
      category: { select: { name: true, slug: true } },
      owner: { select: { username: true, image: true, emailVerified: true, createdAt: true } },
    },
  });
}

export async function updateSchedule(id: string, scheduledFor: Date): Promise<void> {
  await requireAdmin();
  await prisma.submission.update({
    where: { id },
    data: { scheduledFor },
  });
  revalidatePath("/admin");
}

export async function publishSubmissionNow(id: string): Promise<void> {
  await requireAdmin();

  const sub = await prisma.submission.findUnique({
    where: { id },
    include: { owner: true, category: true },
  });
  if (!sub) throw new Error("SUBMISSION_NOT_FOUND");
  if (sub.status === "REJECTED") throw new Error("SUBMISSION_REJECTED");

  // Same publisher the scheduler uses — claims the row atomically, creates
  // the Product, and links any purchased spotlight slot.
  const { publishSubmission } = await import("@/lib/publish");
  const res = await publishSubmission(sub.id, { allowStatuses: ["SCHEDULED", "DRAFT"], enforceFreeGate: false });
  if (res.status !== "published") {
    revalidatePath("/admin");
    revalidatePath("/");
    if (res.status === "skipped") throw new Error(`PUBLISH_SKIPPED_${res.reason.toUpperCase()}`);
    return;
  }

  // Social broadcast + founder email + search indexing run as background
  // jobs (deduplicated per product, so nothing is ever sent twice).
  const { emit } = await import("@/lib/jobs");
  await emit("broadcast.launches", { productIds: [res.productId] }, { dedupeKey: `broadcast.launches:now:${res.productId}` });
  await emit("product.launched", { productId: res.productId }, { dedupeKey: `product.launched:${res.productId}` });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/founders");
  revalidatePath("/category");
  revalidatePath("/profile");
  revalidatePath(`/product/${res.slug}`);
  revalidatePath(`/badges/${res.slug}`);
}

export async function publishAllScheduledSubmissions(): Promise<{ count: number }> {
  await requireAdmin();

  const scheduled = await prisma.submission.findMany({
    where: { status: "SCHEDULED" },
    select: { id: true, name: true },
    orderBy: { scheduledFor: "asc" },
  });

  if (scheduled.length === 0) {
    return { count: 0 };
  }

  let successCount = 0;
  for (const s of scheduled) {
    try {
      await publishSubmissionNow(s.id);
      successCount++;
    } catch (err) {
      console.error(`[publish-all] Error publishing ${s.id} (${s.name}):`, err);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/category");

  return { count: successCount };
}


export async function rejectSubmission(id: string, reason: string): Promise<void> {
  await requireAdmin();
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("REASON_REQUIRED");
  const sub = await prisma.submission.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: trimmed,
    },
    include: { owner: true },
  });

  const { emit } = await import("@/lib/jobs");
  await emit("submission.rejected", { submissionId: sub.id, reason: trimmed });

  revalidatePath("/admin");
  revalidatePath("/profile");
}

export async function deleteSubmission(id: string): Promise<void> {
  await requireAdmin();
  await prisma.submission.delete({ where: { id } });
  revalidatePath("/admin");
}

/**
 * Delete an unlaunched submission (DRAFT, SCHEDULED / in-queue, or REJECTED)
 * owned by the current user. Once a product is PUBLISHED / launched, it cannot
 * be deleted via this user action.
 */
export async function deleteMySubmission(submissionId: string): Promise<void> {
  const user = await requireUser();
  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub || sub.ownerId !== user.id) throw new Error("FORBIDDEN");
  if (sub.status === "PUBLISHED" || sub.publishedProductId) {
    throw new Error("CANNOT_DELETE_PUBLISHED_PRODUCT");
  }
  await prisma.submission.delete({ where: { id: submissionId } });
  revalidatePath("/profile");
}

export async function deleteMyDraft(submissionId: string): Promise<void> {
  return deleteMySubmission(submissionId);
}

/* ─────────── user-facing status lookup ─────────── */

export async function getMySubmission(id: string): Promise<Submission | null> {
  const user = await requireUser();
  const sub = await prisma.submission.findUnique({ where: { id } });
  if (!sub || sub.ownerId !== user.id) return null;
  return sub;
}

/**
 * Payload the /submit?edit=<id> page reads to prefill its form for editing.
 * `id` is either `sub:<submissionId>` or `prod:<productId>`. Owner-only.
 */
export type EditablePayload = {
  kind: "submission" | "product";
  submissionId?: string;
  productId?: string;
  status?: string;
  rejectionReason?: string | null;
  name: string;
  tagline: string;
  description: string;
  websiteUrl: string;
  logoUrl: string;
  screenshots: string[];
  videoUrl: string;
  tags: string[];
  categorySlug: string;
  makerName: string;
  makerHandle: string;
  details?: Record<string, unknown> | null;
};

export async function getEditablePayload(idParam: string): Promise<EditablePayload | null> {
  const user = await requireUser();
  if (idParam.startsWith("sub:")) {
    const sub = await prisma.submission.findUnique({
      where: { id: idParam.slice(4) },
      include: { category: { select: { slug: true, name: true } } },
    });
    if (!sub || sub.ownerId !== user.id) return null;
    const dt = (sub.details as Record<string, unknown>) ?? null;
    const rawTags = sub.tags && sub.tags.length > 0 ? sub.tags : ((dt?.tags as string[]) || []);
    const rawVideo = sub.videoUrl || (dt?.videoUrl as string) || "";
    return {
      kind: "submission",
      submissionId: sub.id,
      status: sub.status,
      rejectionReason: sub.rejectionReason,
      name: sub.name,
      tagline: sub.tagline,
      description: sub.description ?? "",
      websiteUrl: sub.websiteUrl,
      logoUrl: sub.logoUrl ?? "",
      screenshots: sub.screenshots ?? [],
      videoUrl: rawVideo,
      tags: rawTags,
      categorySlug: sub.category?.name || sub.category?.slug || "",
      makerName: sub.makerName,
      makerHandle: sub.makerHandle,
      details: dt,
    };
  }
  if (idParam.startsWith("prod:")) {
    const prod = await prisma.product.findUnique({
      where: { id: idParam.slice(5) },
      include: { category: { select: { slug: true, name: true } } },
    });
    if (!prod || prod.ownerId !== user.id) return null;
    const dt = (prod.details as Record<string, unknown>) ?? null;
    const rawTags = prod.tags && prod.tags.length > 0 ? prod.tags : ((dt?.tags as string[]) || []);
    const rawVideo = prod.videoUrl || (dt?.videoUrl as string) || "";
    return {
      kind: "product",
      productId: prod.id,
      status: prod.status,
      name: prod.name,
      tagline: prod.tagline,
      description: prod.description ?? "",
      websiteUrl: prod.websiteUrl,
      logoUrl: prod.logoUrl ?? "",
      screenshots: prod.screenshots ?? [],
      videoUrl: rawVideo,
      tags: rawTags,
      categorySlug: prod.category?.name || prod.category?.slug || "",
      makerName: user.name || user.username,
      makerHandle: `@${user.username}`,
      details: dt,
    };
  }
  return null;
}

const UpdateFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  tagline: z.string().min(1).max(250),
  description: z.string().optional().nullable(),
  websiteUrl: z.string().optional().or(z.literal("")),
  categorySlug: z.string().optional().nullable(),
  logoUrl: imageString.optional().or(z.literal("")).nullable(),
  screenshots: z.array(imageString).max(8).optional().nullable(),
  videoUrl: videoUrlSchema,
  tags: tagsSchema,
  details: z.record(z.string(), z.unknown()).optional().nullable(),
});

/** Update a submission the user owns. Pending stays pending, rejected
 *  gets put back on the queue (schedule/status reset + reason cleared).
 *
 *  When `opts.keepAsDraft` is true and the row is currently a DRAFT, the
 *  update saves the changes but does NOT promote the row to SCHEDULED — the
 *  draft stays a draft. Used by the "Update Draft" button on the submit
 *  form so founders can iterate on a draft without pushing it live. */
export async function updateMySubmission(
  submissionId: string,
  fields: z.infer<typeof UpdateFieldsSchema>,
  opts?: { keepAsDraft?: boolean },
): Promise<Submission> {
  const user = await requireUser();
  const parsed = UpdateFieldsSchema.parse(fields);
  const existing = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!existing) throw new Error("SUBMISSION_NOT_FOUND");
  if (existing.ownerId !== user.id) throw new Error("FORBIDDEN");
  if (existing.status === "PUBLISHED") throw new Error("ALREADY_PUBLISHED");

  const category = parsed.categorySlug
    ? await prisma.category.findUnique({ where: { slug: parsed.categorySlug } })
    : null;

  const wasRejected = existing.status === "REJECTED";
  const wasDraft = existing.status === "DRAFT";
  const keepAsDraft = opts?.keepAsDraft === true && wasDraft;

  const logoUrl = parsed.logoUrl !== undefined ? await processImageString(parsed.logoUrl, "logos") : existing.logoUrl;
  let screenshots = existing.screenshots;
  if (parsed.screenshots !== undefined) {
    const list: string[] = [];
    if (parsed.screenshots) {
      for (const scr of parsed.screenshots) {
        const uploaded = await processImageString(scr, "screenshots");
        if (uploaded) list.push(uploaded);
      }
    }
    screenshots = list;
  }

  const finalVideoUrl = parsed.videoUrl !== undefined ? (parsed.videoUrl || null) : existing.videoUrl;
  const finalTags = parsed.tags !== undefined ? parsed.tags : existing.tags;

  const existingDetails = (existing.details as Record<string, unknown>) || {};
  const freeLaunch = await import("@/lib/free-launch");
  const updatedDetails: Record<string, unknown> = {
    ...existingDetails,
    ...(freeLaunch.stripProtectedDetails(parsed.details as Record<string, unknown> | null) ?? {}),
    // Server-owned keys (payment, free-launch stamp) always come from the DB row.
    ...freeLaunch.pickProtectedDetails(existingDetails),
    videoUrl: finalVideoUrl,
    tags: finalTags,
    // Keep old + new site keys so an already-embedded badge keeps resolving.
    badgeKeys: freeLaunch.withBadgeKeys(existingDetails.badgeKeys, existing.websiteUrl, parsed.websiteUrl || existing.websiteUrl),
  };
  freeLaunch.dropSecrets(updatedDetails); // purge any legacy plaintext key

  // Entering the launch queue as an unpaid $5 / $10 launch → stay a draft
  // until checkout succeeds (activatePlacementSlot promotes it).
  const enteringQueue = !keepAsDraft && (wasDraft || wasRejected);
  const tier = freeLaunch.requestedTier(updatedDetails);
  const isPaid = freeLaunch.isPaidLaunch(existingDetails);
  const awaitingPayment = enteringQueue && !isPaid && tier !== 0;
  if (awaitingPayment) {
    updatedDetails.awaitingPayment = freeLaunch.awaitingPaymentStamp(tier);
  } else if (isPaid || tier === 0) {
    delete updatedDetails.awaitingPayment;
  }

  // Entering the launch queue as a free launch → enforce the requirements.
  if (
    enteringQueue &&
    !isPaid &&
    tier === 0 &&
    !(existingDetails.freeLaunch as { qualified?: boolean } | undefined)?.qualified
  ) {
    const gate = await freeLaunch.requireFreeGate(user.id, parsed.websiteUrl || existing.websiteUrl, existing.id);
    if (!gate.qualified) throw new Error(gate.message || "FREE_LAUNCH_REQUIREMENTS_NOT_MET");
    updatedDetails.freeLaunch = freeLaunch.freeLaunchStamp(gate);
  }
  if (updatedDetails.freeGateVersion === undefined && (wasDraft || wasRejected)) {
    updatedDetails.freeGateVersion = freeLaunch.FREE_GATE_VERSION;
  }

  const scheduledFor = keepAsDraft
    ? existing.scheduledFor
    : awaitingPayment
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : wasRejected || wasDraft
        ? getNext6AmIstRelease()
        : existing.scheduledFor;

  const sub = await prisma.submission.update({
    where: { id: existing.id },
    data: {
      name: parsed.name,
      tagline: parsed.tagline,
      description: parsed.description ?? existing.description,
      websiteUrl: parsed.websiteUrl || existing.websiteUrl,
      logoUrl,
      screenshots,
      videoUrl: finalVideoUrl,
      tags: finalTags,
      categoryId: category?.id ?? existing.categoryId,
      details: updatedDetails as any,
      status: keepAsDraft || awaitingPayment ? "DRAFT" : "SCHEDULED",
      scheduledFor,
      rejectedAt: null,
      rejectionReason: null,
    },
  });

  // Founder confirmation email whenever the row actually enters the queue.
  if (enteringQueue && !awaitingPayment) {
    const { emit } = await import("@/lib/jobs");
    await emit("submission.created", { submissionId: sub.id });
  }

  revalidatePath("/admin");
  revalidatePath("/profile");
  return sub;
}

/** Update a live product the user owns. Only touches the DB columns
 *  that actually exist on Product (name, tagline, description, urls, tags). */
export async function updateMyProduct(
  productId: string,
  fields: z.infer<typeof UpdateFieldsSchema>,
): Promise<{ slug: string }> {
  const user = await requireUser();
  const parsed = UpdateFieldsSchema.parse(fields);
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new Error("PRODUCT_NOT_FOUND");
  if (existing.ownerId !== user.id) throw new Error("FORBIDDEN");

  const category = await resolveCategory(parsed.categorySlug || (existing.details as any)?.category);

  const logoUrl = parsed.logoUrl !== undefined ? await processImageString(parsed.logoUrl, "logos") : existing.logoUrl;
  let screenshots = existing.screenshots;
  if (parsed.screenshots !== undefined) {
    const list: string[] = [];
    if (parsed.screenshots) {
      for (const scr of parsed.screenshots) {
        const uploaded = await processImageString(scr, "screenshots");
        if (uploaded) list.push(uploaded);
      }
    }
    screenshots = list;
  }

  const finalVideoUrl = parsed.videoUrl !== undefined ? (parsed.videoUrl || null) : existing.videoUrl;
  const finalTags = parsed.tags !== undefined ? parsed.tags : existing.tags;

  const existingDetails = (existing.details as Record<string, unknown>) || {};
  const freeLaunch = await import("@/lib/free-launch");
  const updatedDetails: Record<string, unknown> = {
    ...existingDetails,
    ...(freeLaunch.stripProtectedDetails(parsed.details as Record<string, unknown> | null) ?? {}),
    // Server-owned keys (payment, free-launch stamp) always come from the DB row.
    ...freeLaunch.pickProtectedDetails(existingDetails),
    videoUrl: finalVideoUrl,
    tags: finalTags,
    // Keep old + new site keys so an already-embedded badge keeps resolving.
    badgeKeys: freeLaunch.withBadgeKeys(existingDetails.badgeKeys, existing.websiteUrl, parsed.websiteUrl || existing.websiteUrl),
  };
  freeLaunch.dropSecrets(updatedDetails); // purge any legacy plaintext key

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      name: parsed.name,
      tagline: parsed.tagline,
      description: parsed.description ?? existing.description,
      websiteUrl: parsed.websiteUrl || existing.websiteUrl,
      logoUrl,
      screenshots,
      videoUrl: finalVideoUrl,
      tags: finalTags,
      categoryId: category?.id ?? existing.categoryId,
      details: updatedDetails as any,
    },
    select: { slug: true },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath(`/product/${updated.slug}`);

  // Automated Web Search Indexing (Google Indexing API & IndexNow)
  try {
    const { submitUrl } = await import("@/lib/indexing");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
    await submitUrl(`${appUrl}/product/${encodeURIComponent(updated.slug)}`, { type: "URL_UPDATED" });
  } catch (err) {
    console.error("[web-indexing] failed for updateProduct:", err);
  }

  return updated;
}

/**
 * Edit a REJECTED submission and put it back into the queue.
 * Owner-only. Clears rejection metadata, schedules for now + leadHours,
 * fires the "product-submitted" email again.
 */
const ResubmitSchema = z.object({
  submissionId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  tagline: z.string().trim().min(1).max(250),
  description: z.string().optional(),
  websiteUrl: z.string().optional().or(z.literal("")),
  categorySlug: z.string().optional(),
});

export type ResubmitInput = z.infer<typeof ResubmitSchema>;

export async function resubmitSubmission(input: ResubmitInput): Promise<Submission> {
  const user = await requireUser();
  const parsed = ResubmitSchema.parse(input);

  const existing = await prisma.submission.findUnique({
    where: { id: parsed.submissionId },
  });
  if (!existing) throw new Error("SUBMISSION_NOT_FOUND");
  if (existing.ownerId !== user.id) throw new Error("FORBIDDEN");
  if (existing.status !== "REJECTED") throw new Error("ONLY_REJECTED_CAN_BE_RESUBMITTED");

  const category = await resolveCategory(parsed.categorySlug);
  const scheduledFor = getNext6AmIstRelease();

  const sub = await prisma.submission.update({
    where: { id: existing.id },
    data: {
      name: parsed.name,
      tagline: parsed.tagline,
      description: parsed.description ?? existing.description,
      websiteUrl: parsed.websiteUrl || existing.websiteUrl,
      categoryId: category?.id ?? existing.categoryId,
      details: {
        ...((existing.details as Record<string, unknown>) || {}),
        badgeKeys: (await import("@/lib/free-launch")).withBadgeKeys(
          (existing.details as Record<string, unknown> | null)?.badgeKeys,
          existing.websiteUrl,
          parsed.websiteUrl || existing.websiteUrl
        ),
      } as any,
      status: "SCHEDULED",
      scheduledFor,
      rejectedAt: null,
      rejectionReason: null,
    },
  });

  const { emit } = await import("@/lib/jobs");
  await emit("submission.created", { submissionId: sub.id });

  revalidatePath("/admin");
  revalidatePath("/profile");
  return sub;
}

/* ─────────── util ─────────── */

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Type re-export so client can share the status literal without importing Prisma. */
export type SubmissionRow = Omit<Submission, "status"> & { status: SubmissionStatus };
