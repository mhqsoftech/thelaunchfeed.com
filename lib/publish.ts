/**
 * Shared submission → product publisher.
 *
 * Used by both the scheduled publisher (lib/jobs cron "publish-due") and the
 * admin "Publish now" action, so the two paths can never drift apart again
 * (the old Inngest cron skipped the category fallback and never linked a
 * purchased spotlight slot).
 *
 * Concurrency-safe: the submission row is claimed with a conditional
 * UPDATE inside the transaction, so two runners racing on the same
 * submission produce exactly one Product.
 */

import { prisma } from "@/lib/db";

export type PublishResult =
  | { status: "published"; productId: string; slug: string }
  | { status: "already-published"; productId: string | null }
  | { status: "skipped"; reason: string };

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function ensureUniqueSlug(base: string): Promise<string> {
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

const ALREADY = "__ALREADY_PUBLISHED__";

export async function publishSubmission(
  submissionId: string,
  opts: {
    allowStatuses?: Array<"SCHEDULED" | "DRAFT">;
    /** false = admin override ("Publish now") skips the free-launch requirements. */
    enforceFreeGate?: boolean;
  } = {}
): Promise<PublishResult> {
  const allowStatuses = opts.allowStatuses ?? ["SCHEDULED"];
  const enforceFreeGate = opts.enforceFreeGate ?? true;

  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { category: true },
  });
  if (!sub) return { status: "skipped", reason: "not-found" };
  if (sub.status === "PUBLISHED" || sub.publishedProductId) {
    return { status: "already-published", productId: sub.publishedProductId };
  }
  if (!allowStatuses.includes(sub.status as "SCHEDULED" | "DRAFT")) {
    return { status: "skipped", reason: `status-${sub.status.toLowerCase()}` };
  }

  // Guard against a double publish from an older runner (e.g. the previous
  // Inngest deployment) that created the product but never linked it back.
  const recent = await prisma.product.findFirst({
    where: {
      ownerId: sub.ownerId,
      name: { equals: sub.name, mode: "insensitive" },
      launchedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      fromSubmission: null,
    },
    select: { id: true },
  });

  const now = new Date();

  if (recent) {
    const claimed = await prisma.submission.updateMany({
      where: { id: sub.id, status: { in: allowStatuses }, publishedProductId: null },
      data: { status: "PUBLISHED", publishedAt: now, publishedProductId: recent.id },
    });
    return claimed.count > 0
      ? { status: "already-published", productId: recent.id }
      : { status: "skipped", reason: "claimed-elsewhere" };
  }

  const details = (sub.details as Record<string, unknown>) || {};

  // Free-launch requirements (lib/free-launch.ts). Applies to submissions
  // created after the gate shipped that are neither paid nor already
  // qualified — e.g. a $5/$10 pick whose checkout was abandoned. They stay
  // queued and go live on the first tick after the maker pays or qualifies.
  const fl = await import("@/lib/free-launch");
  const freeStamp = details.freeLaunch as { qualified?: boolean } | undefined;
  if (enforceFreeGate && details.freeGateVersion && !fl.isPaidLaunch(details) && !freeStamp?.qualified) {
    const hold = details.publishHold as { checkedAt?: string } | undefined;
    if (hold?.checkedAt && Date.now() - Date.parse(hold.checkedAt) < 10 * 60_000) {
      return { status: "skipped", reason: "free-requirements" };
    }
    const gate = await fl.evaluateFreeGate(sub.ownerId, sub.websiteUrl, { excludeSubmissionId: sub.id });
    if (!gate.qualified) {
      await prisma.submission.update({
        where: { id: sub.id },
        data: {
          details: {
            ...details,
            publishHold: { reason: "free-requirements", message: gate.message, checkedAt: new Date().toISOString() },
          } as any,
        },
      });
      return { status: "skipped", reason: "free-requirements" };
    }
    details.freeLaunch = fl.freeLaunchStamp(gate);
  }
  delete details.publishHold;
  // Paid or badge-verified free launches get a dofollow website link; the
  // nightly badge audit flips free ones to nofollow if the badge disappears.
  details.backlinkRel = "dofollow";

  const videoUrl = sub.videoUrl || (details.videoUrl as string) || null;
  const tags = sub.tags && sub.tags.length > 0 ? sub.tags : ((details.tags as string[]) || []);

  let categoryId = sub.categoryId;
  if (!categoryId) {
    try {
      const { resolveCategory } = await import("@/app/actions/submissions");
      const fallback = await resolveCategory((details.category as string) || tags[0] || sub.name);
      categoryId = fallback?.id ?? null;
    } catch {
      categoryId = null;
    }
  }

  const slug = await ensureUniqueSlug(slugify(sub.name));

  let product: { id: string; slug: string };
  try {
    product = await prisma.$transaction(
      async (tx) => {
        // Atomic claim — only one runner can flip this row.
        const claim = await tx.submission.updateMany({
          where: { id: sub.id, status: { in: allowStatuses }, publishedProductId: null },
          data: { status: "PUBLISHED", publishedAt: now, scheduledFor: now < sub.scheduledFor ? now : sub.scheduledFor },
        });
        if (claim.count === 0) throw new Error(ALREADY);

        const p = await tx.product.create({
          data: {
            slug,
            name: sub.name,
            tagline: sub.tagline,
            description: sub.description,
            websiteUrl: sub.websiteUrl,
            logoUrl: sub.logoUrl,
            screenshots: sub.screenshots,
            videoUrl,
            tags,
            categoryId,
            details: details as any,
            ownerId: sub.ownerId,
            status: "LIVE",
            launchedAt: now,
            voteCount: 1,
          },
          select: { id: true, slug: true },
        });
        await tx.productMaker.create({
          data: { productId: p.id, userId: sub.ownerId, role: "maker" },
        });
        await tx.vote.create({ data: { productId: p.id, userId: sub.ownerId } });
        await tx.submission.update({
          where: { id: sub.id },
          data: { publishedProductId: p.id, details: details as any },
        });
        return p;
      },
      { timeout: 20_000 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === ALREADY) {
      const fresh = await prisma.submission.findUnique({
        where: { id: sub.id },
        select: { publishedProductId: true },
      });
      return { status: "already-published", productId: fresh?.publishedProductId ?? null };
    }
    throw err;
  }

  // Purchased spotlight slot → attach to the live product, start 30-day window.
  try {
    const purchaseId = details.purchaseId as string | undefined;
    const slot = await prisma.featuredSlot.findFirst({
      where: {
        OR: [
          ...(purchaseId ? [{ purchaseId }] : []),
          { customUrl: `/product/${product.slug}` },
          { customName: sub.name },
        ],
      },
    });
    if (slot) {
      await prisma.featuredSlot.update({
        where: { id: slot.id },
        data: {
          productId: product.id,
          startsAt: now,
          endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      const { invalidateSlotsCache } = await import("@/lib/queries/slots");
      invalidateSlotsCache();
    }
  } catch (e) {
    console.warn("[publishSubmission] failed to link FeaturedSlot:", e);
  }

  return { status: "published", productId: product.id, slug: product.slug };
}
