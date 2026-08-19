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

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  tagline: z.string().min(1).max(250).or(z.literal("")),
  websiteUrl: z.string().optional().or(z.literal("")),
  description: z.string().optional(),
  categorySlug: z.string().optional(),
  makerName: z.string().min(1),
  makerHandle: z.string().min(1),
  logoUrl: imageString.optional().or(z.literal("")),
  screenshots: z.array(imageString).max(8).optional(),
  videoUrl: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => {
        if (!v) return true;
        try {
          const host = new URL(v).hostname.toLowerCase();
          return (
            host === "youtube.com" ||
            host.endsWith(".youtube.com") ||
            host === "youtu.be" ||
            host === "vimeo.com" ||
            host.endsWith(".vimeo.com") ||
            host === "loom.com" ||
            host.endsWith(".loom.com")
          );
        } catch {
          return false;
        }
      },
      { message: "videoUrl must be a YouTube, Vimeo, or Loom URL" }
    ),
  tags: z.array(z.string().max(60)).max(20).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
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
      return await uploadToNeonStorage(parsed.buffer, key, parsed.contentType);
    }
  }
  return img;
}

function extractDomainAndPath(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  let clean = rawUrl.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.replace(/^www\./, "");
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

export async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
  const user = await requireUser();
  const parsed = CreateSchema.parse(input);
  const isDraft = parsed.asDraft === true;

  // Idempotency: Prevent duplicate submissions if triggered twice in quick succession by same user
  const recentDuplicate = await prisma.submission.findFirst({
    where: {
      ownerId: user.id,
      name: { equals: parsed.name, mode: "insensitive" },
      status: isDraft ? "DRAFT" : "SCHEDULED",
      createdAt: { gte: new Date(Date.now() - 30_000) },
    },
  });
  if (recentDuplicate) {
    return recentDuplicate;
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
        throw new Error(
          `This product (${existingProduct.name} · ${domain}) has already been launched on The Launch Feed. Each product URL can only be submitted once.`
        );
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
          // Same user re-submitting — return their existing row silently.
          const row = await prisma.submission.findUnique({ where: { id: existingSubmission.id } });
          if (row) return row;
        }
        // Do not leak the queued submission's name or owner — enumerating
        // this endpoint would otherwise reveal every draft/scheduled launch
        // by URL or product name.
        throw new Error(
          `A launch is already queued for ${domain}. Duplicate submissions are not permitted.`
        );
      }
    }
  }

  const scheduledFor = isDraft ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : getNext6AmIstRelease();

  const category = await resolveCategory(parsed.categorySlug);

  const [logoUrl, uploadedScreenshots] = await Promise.all([
    processImageString(parsed.logoUrl, "logos"),
    parsed.screenshots
      ? Promise.all(parsed.screenshots.map((scr) => processImageString(scr, "screenshots")))
      : Promise.resolve<Array<string | null>>([]),
  ]);
  const screenshots: string[] = uploadedScreenshots.filter((s): s is string => !!s);

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
      details: parsed.details ? (parsed.details as any) : undefined,
      makerName: parsed.makerName,
      makerHandle: parsed.makerHandle,
      makerEmail: user.email,
      status: isDraft ? "DRAFT" : "SCHEDULED",
      scheduledFor,
    },
  });

  if (isDraft) {
    return sub;
  }

  // Fire the "product submitted" email + inngest event AS A BACKGROUND job so
  // the client sees the queued-launch screen instantly. If Resend or the inngest
  // producer is slow, it must not block the server action from returning.
  (async () => {
    try {
      const { sendAndLog } = await import("@/lib/inngest/functions");
      await sendAndLog({
        templateId: "product-submitted",
        to: user.email,
        toUserId: user.id,
        trigger: "on-submit",
        vars: {
          productName: sub.name,
          productSlug: slugify(sub.name),
          userName: user.name || user.username,
          slotExpiresOn: sub.scheduledFor.toISOString().slice(0, 10),
        },
      });
    } catch (e) {
      console.error("[submission-email] failed:", e);
    }
    try {
      const { inngest } = await import("@/lib/inngest");
      await inngest.send({ name: "submission.created", data: { submissionId: sub.id } });
    } catch {
      // Inngest not wired in this env — email already dispatched above.
    }
  })().catch((e) => console.error("[submission:background] failed:", e));

  revalidatePath("/admin");
  revalidatePath("/submit");
  revalidatePath("/profile");
  return sub;
}

/* ─────────── admin ─────────── */

export async function listSubmissions(): Promise<Submission[]> {
  await requireAdmin();
  return prisma.submission.findMany({
    orderBy: [{ status: "asc" }, { scheduledFor: "asc" }],
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

  const now = new Date();

  // If already published, just make sure the timestamp/link exist and no-op.
  if (sub.status === "PUBLISHED" && sub.publishedProductId) {
    revalidatePath("/admin");
    revalidatePath("/");
    return;
  }

  // Do the publish in-process instead of waiting for the Inngest cron —
  // creates the Product row, flips the submission to PUBLISHED, links
  // them via publishedProductId (satisfying the schema's @unique),
  // and fires the launch email inline.
  const slug = await ensureUniqueSlug(slugify(sub.name));
  const fallbackCat = sub.categoryId ? null : await resolveCategory((sub.details as any)?.category || sub.tags?.[0] || sub.name);
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        slug,
        name: sub.name,
        tagline: sub.tagline,
        description: sub.description,
        websiteUrl: sub.websiteUrl,
        logoUrl: sub.logoUrl,
        screenshots: sub.screenshots,
        videoUrl: sub.videoUrl,
        tags: sub.tags,
        categoryId: sub.categoryId || fallbackCat?.id,
        details: sub.details ?? undefined,
        ownerId: sub.ownerId,
        status: "LIVE",
        launchedAt: now,
        voteCount: 1,
      },
    });
    await tx.vote.create({
      data: {
        productId: p.id,
        userId: sub.ownerId,
      },
    });
    await tx.submission.update({
      where: { id: sub.id },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        publishedProductId: p.id,
        scheduledFor: now,
      },
    });
    return p;
  });

  // If a featured/spotlight slot was purchased for this submission, connect it to the published product and start 30-day window
  try {
    const subPurchaseId = (sub.details as Record<string, unknown>)?.purchaseId as string | undefined;
    const matchingSlot = await prisma.featuredSlot.findFirst({
      where: {
        OR: [
          ...(subPurchaseId ? [{ purchaseId: subPurchaseId }] : []),
          { customUrl: `/product/${slug}` },
          { customName: sub.name },
        ],
      },
    });

    if (matchingSlot) {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      await prisma.featuredSlot.update({
        where: { id: matchingSlot.id },
        data: {
          productId: product.id,
          startsAt: now,
          endsAt: new Date(now.getTime() + thirtyDaysMs),
        },
      });
      const { invalidateSlotsCache } = await import("@/lib/queries/slots");
      invalidateSlotsCache();
    }
  } catch (e) {
    console.warn("[publishSubmissionNow] Failed to link FeaturedSlot:", e);
  }

  // Send the "product-launched" email to the owner right now so they hear
  // about it even without Inngest. The wider broadcast to all subscribers
  // still fans out through the Inngest handler when it's running.
  try {
    const { sendAndLog } = await import("@/lib/inngest/functions");
    await sendAndLog({
      templateId: "product-launched",
      to: sub.owner.email,
      toUserId: sub.owner.id,
      trigger: "on-launch",
      vars: {
        productName: product.name,
        productSlug: product.slug,
        userName: sub.owner.name || sub.owner.username,
      },
    });
  } catch (e) {
    console.error("[launch-email] failed:", e);
  }
  try {
    const { broadcastProductLaunch } = await import("@/lib/broadcast");
    await broadcastProductLaunch({
      id: product.id,
      name: product.name,
      slug: product.slug,
      tagline: product.tagline,
      makerName: sub.owner.name || sub.owner.username,
      makerHandle: sub.owner.username ? `@${sub.owner.username}` : undefined,
      category: sub.category?.name || undefined,
      tags: sub.tags,
      websiteUrl: sub.websiteUrl,
    });
  } catch (e) {
    console.error("[social-broadcast] inline failed:", e);
  }

  try {
    const { inngest } = await import("@/lib/inngest");
    await inngest.send({ name: "product.launched", data: { productId: product.id } });
  } catch {
    // Inngest not wired — owner email and broadcast already handled inline.
  }

  // Automated Web Search Indexing (Google Indexing API & IndexNow)
  try {
    const { submitBatch } = await import("@/lib/indexing");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
    const urlsToIndex = [
      `${appUrl}/product/${encodeURIComponent(product.slug)}`,
      `${appUrl}/`,
    ];
    if (sub.category?.slug) {
      urlsToIndex.push(`${appUrl}/category/${encodeURIComponent(sub.category.slug)}`);
    }
    await submitBatch(urlsToIndex);
  } catch (e) {
    console.error("[web-indexing] inline publish failed:", e);
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath(`/product/${product.slug}`);
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

/**
 * Reserve a unique slug — appends `-2`, `-3`, … if the base is taken.
 * Kept local to this action so the same helper Inngest uses is duplicated
 * in only one place per publish path.
 */
async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base || `product-${Date.now().toString(36)}`;
  for (let i = 2; i < 200; i++) {
    const clash = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
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

  try {
    const { sendAndLog } = await import("@/lib/inngest/functions");
    await sendAndLog({
      templateId: "product-rejected",
      to: sub.owner.email,
      toUserId: sub.owner.id,
      trigger: "on-reject",
      vars: {
        productName: sub.name,
        productSlug: slugify(sub.name),
        userName: sub.owner.name || sub.owner.username,
        rejectionReason: trimmed,
      },
    });
  } catch (e) {
    console.error("[reject-email] failed:", e);
  }
  try {
    const { inngest } = await import("@/lib/inngest");
    await inngest.send({
      name: "submission.rejected",
      data: { submissionId: id, reason: trimmed },
    });
  } catch {}

  revalidatePath("/admin");
  revalidatePath("/profile");
}

export async function deleteSubmission(id: string): Promise<void> {
  await requireAdmin();
  await prisma.submission.delete({ where: { id } });
  revalidatePath("/admin");
}

/**
 * Delete a draft submission owned by the current user.
 * Only DRAFT rows may be deleted this way — scheduled/published items are
 * managed by admin actions.
 */
export async function deleteMyDraft(submissionId: string): Promise<void> {
  const user = await requireUser();
  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub || sub.ownerId !== user.id) throw new Error("FORBIDDEN");
  if (sub.status !== "DRAFT") throw new Error("NOT_A_DRAFT");
  await prisma.submission.delete({ where: { id: submissionId } });
  revalidatePath("/profile");
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
      videoUrl: sub.videoUrl ?? "",
      tags: sub.tags ?? [],
      categorySlug: sub.category?.name || sub.category?.slug || "",
      makerName: sub.makerName,
      makerHandle: sub.makerHandle,
      details: (sub.details as Record<string, unknown>) ?? null,
    };
  }
  if (idParam.startsWith("prod:")) {
    const prod = await prisma.product.findUnique({
      where: { id: idParam.slice(5) },
      include: { category: { select: { slug: true, name: true } } },
    });
    if (!prod || prod.ownerId !== user.id) return null;
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
      videoUrl: prod.videoUrl ?? "",
      tags: prod.tags ?? [],
      categorySlug: prod.category?.name || prod.category?.slug || "",
      makerName: user.name || user.username,
      makerHandle: `@${user.username}`,
      details: (prod.details as Record<string, unknown>) ?? null,
    };
  }
  return null;
}

const UpdateFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  tagline: z.string().min(1).max(250),
  description: z.string().optional(),
  websiteUrl: z.string().optional().or(z.literal("")),
  categorySlug: z.string().optional(),
  logoUrl: imageString.optional().or(z.literal("")),
  screenshots: z.array(imageString).max(8).optional(),
  videoUrl: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => {
        if (!v) return true;
        try {
          const host = new URL(v).hostname.toLowerCase();
          return (
            host === "youtube.com" ||
            host.endsWith(".youtube.com") ||
            host === "youtu.be" ||
            host === "vimeo.com" ||
            host.endsWith(".vimeo.com") ||
            host === "loom.com" ||
            host.endsWith(".loom.com")
          );
        } catch {
          return false;
        }
      },
      { message: "videoUrl must be a YouTube, Vimeo, or Loom URL" }
    ),
  tags: z.array(z.string().max(60)).max(20).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** Update a submission the user owns. Pending stays pending, rejected
 *  gets put back on the queue (schedule/status reset + reason cleared). */
export async function updateMySubmission(
  submissionId: string,
  fields: z.infer<typeof UpdateFieldsSchema>,
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
  const scheduledFor = wasRejected || wasDraft
    ? getNext6AmIstRelease()
    : existing.scheduledFor;

  const logoUrl = parsed.logoUrl !== undefined ? await processImageString(parsed.logoUrl, "logos") : existing.logoUrl;
  let screenshots = existing.screenshots;
  if (parsed.screenshots !== undefined) {
    const list: string[] = [];
    for (const scr of parsed.screenshots) {
      const uploaded = await processImageString(scr, "screenshots");
      if (uploaded) list.push(uploaded);
    }
    screenshots = list;
  }

  const sub = await prisma.submission.update({
    where: { id: existing.id },
    data: {
      name: parsed.name,
      tagline: parsed.tagline,
      description: parsed.description ?? existing.description,
      websiteUrl: parsed.websiteUrl || existing.websiteUrl,
      logoUrl,
      screenshots,
      videoUrl: parsed.videoUrl === undefined ? existing.videoUrl : parsed.videoUrl || null,
      tags: parsed.tags ?? existing.tags,
      categoryId: category?.id ?? existing.categoryId,
      details: parsed.details !== undefined ? (parsed.details as any) : existing.details,
      status: "SCHEDULED",
      scheduledFor,
      rejectedAt: null,
      rejectionReason: null,
    },
  });

  if (wasRejected) {
    try {
      const { sendAndLog } = await import("@/lib/inngest/functions");
      await sendAndLog({
        templateId: "product-submitted",
        to: user.email,
        toUserId: user.id,
        trigger: "on-submit",
        vars: {
          productName: sub.name,
          productSlug: slugify(sub.name),
          userName: user.name || user.username,
          slotExpiresOn: sub.scheduledFor.toISOString().slice(0, 10),
        },
      });
    } catch (e) {
      console.error("[resubmit-email] failed:", e);
    }
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
    for (const scr of parsed.screenshots) {
      const uploaded = await processImageString(scr, "screenshots");
      if (uploaded) list.push(uploaded);
    }
    screenshots = list;
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      name: parsed.name,
      tagline: parsed.tagline,
      description: parsed.description ?? existing.description,
      websiteUrl: parsed.websiteUrl || existing.websiteUrl,
      logoUrl,
      screenshots,
      videoUrl: parsed.videoUrl === undefined ? existing.videoUrl : parsed.videoUrl || null,
      tags: parsed.tags ?? existing.tags,
      categoryId: category?.id ?? existing.categoryId,
      details: parsed.details !== undefined ? (parsed.details as any) : existing.details,
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
      status: "SCHEDULED",
      scheduledFor,
      rejectedAt: null,
      rejectionReason: null,
    },
  });

  try {
    const { sendAndLog } = await import("@/lib/inngest/functions");
    await sendAndLog({
      templateId: "product-submitted",
      to: user.email,
      toUserId: user.id,
      trigger: "on-submit",
      vars: {
        productName: sub.name,
        productSlug: slugify(sub.name),
        userName: user.name || user.username,
        slotExpiresOn: sub.scheduledFor.toISOString().slice(0, 10),
      },
    });
  } catch (e) {
    console.error("[resubmit-email] failed:", e);
  }
  try {
    const { inngest } = await import("@/lib/inngest");
    await inngest.send({ name: "submission.created", data: { submissionId: sub.id } });
  } catch {
    /* Inngest not wired */
  }

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
