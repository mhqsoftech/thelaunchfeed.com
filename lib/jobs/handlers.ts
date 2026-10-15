/**
 * Job handlers — every task the app used to run on Inngest.
 *
 *  Event jobs (enqueued by server actions via `emit`):
 *    email.send.requested · submission.created · submission.rejected
 *    product.launched · comment.posted · indexing.submit.requested
 *    broadcast.launches · broadcast.leaderboard
 *
 *  Scheduled jobs (enqueued by lib/jobs/cron.ts, one per time slot):
 *    cron.publish-due (1 min) · cron.leaderboard (5 min)
 *    cron.indexing-sync (6 h) · cron.outreach (4 h)
 *    cron.directory-crawler (1 h, runs once/day after the configured hour)
 *    cron.outbound-rollup (1 h) · cron.cleanup (24 h)
 *
 *  - RESEND_API_KEY drives real email delivery; without it, sends log to
 *    EmailLog with status=FAILED and errorMessage explaining the miss.
 *  - AutomationRule gates automatic sends (manual sends bypass the check).
 */

import { Resend } from "resend";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTemplate, TemplateVars } from "@/app/admin/emailTemplates";
import {
  getDailyCycleRange,
  getPreviousDailyCycleRange,
  getWeeklyCycleRange,
  getPreviousWeeklyCycleRange,
  getMonthlyCycleRange,
  getPreviousMonthlyCycleRange,
  type CycleRange,
} from "@/lib/schedule";
import { slugify, publishSubmission } from "@/lib/publish";
import { enqueue, type JobRegistry } from "./queue";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "The Launch Feed <hi@thelaunchfeed.com>";
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

/* ─────────── helper: send + log ─────────── */

export async function sendAndLog(input: {
  templateId: string;
  to: string;
  toUserId?: string;
  vars?: TemplateVars;
  trigger?: string;
}) {
  // Skip seed accounts — they never receive emails, even when their products rank.
  try {
    const recipient = input.toUserId
      ? await prisma.user.findUnique({ where: { id: input.toUserId }, select: { isSeed: true } })
      : await prisma.user.findUnique({ where: { email: input.to }, select: { isSeed: true } });
    if (recipient?.isSeed) {
      return { id: "skipped-seed", delivered: false, skipped: true };
    }
  } catch {}

  const tpl = getTemplate(input.templateId as any);
  const subject = tpl.subject(input.vars || {});
  const html = tpl.render(input.vars || {});

  const log = await prisma.emailLog.create({
    data: {
      toEmail: input.to,
      toUserId: input.toUserId,
      templateId: input.templateId,
      subject,
      html,
      status: "QUEUED",
      triggerEvent: input.trigger,
      meta: (input.vars ?? {}) as any,
    },
  });

  if (!resend) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: "RESEND_API_KEY not configured" },
    });
    return { id: log.id, delivered: false };
  }

  try {
    // Idempotency-key uses the EmailLog id so a retry after a transient
    // error does not deliver the same message twice — Resend deduplicates
    // within a 24-hour window on this header.
    // Resend's free tier allows ~2 req/s; back off briefly on 429 instead of
    // failing a broadcast halfway through.
    let res = await resend.emails.send({ from: FROM, to: input.to, subject, html }, { idempotencyKey: log.id });
    for (let i = 0; i < 3 && res.error && /rate.?limit/i.test(`${res.error.name} ${res.error.message}`); i++) {
      await new Promise((r) => setTimeout(r, 1_100 * (i + 1)));
      res = await resend.emails.send({ from: FROM, to: input.to, subject, html }, { idempotencyKey: log.id });
    }
    if (res.error) throw new Error(res.error.message);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT", providerId: res.data?.id, sentAt: new Date() },
    });
    return { id: log.id, delivered: true };
  } catch (err) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : String(err) },
    });
    return { id: log.id, delivered: false };
  }
}

/** Per-template on/off switch set in the admin panel. Missing rules default
 *  to enabled so a newly added template isn't silently suppressed. */
async function isAutomationEnabled(templateId: string): Promise<boolean> {
  const row = await prisma.automationRule.findUnique({ where: { templateId } });
  return row ? row.enabled : true;
}

/** Gate an automated send on its AutomationRule, writing a SKIPPED log when
 *  disabled so the admin can see *why* a founder never got the email. */
async function sendGated(input: {
  templateId: string;
  to: string;
  toUserId?: string;
  vars?: Record<string, unknown>;
  trigger?: string;
}) {
  const { templateId, to, toUserId, vars, trigger } = input;
  if (trigger && trigger !== "manual" && trigger !== "broadcast") {
    if (!(await isAutomationEnabled(templateId))) {
      try {
        const tpl = getTemplate(templateId as any);
        await prisma.emailLog.create({
          data: {
            toEmail: to,
            toUserId,
            templateId,
            subject: tpl.subject((vars ?? {}) as TemplateVars),
            html: "",
            status: "SKIPPED",
            triggerEvent: trigger,
            errorMessage: `automation disabled for template "${templateId}"`,
            meta: (vars ?? {}) as any,
          },
        });
      } catch {}
      return { skipped: true, reason: "automation-disabled" };
    }
  }
  return sendAndLog({ templateId, to, toUserId, vars: vars as TemplateVars, trigger });
}

function revalidate(paths: string[]) {
  // Only valid inside a request scope (cron route / after()); the
  // in-process timer has none, which is fine — those pages are dynamic.
  void import("next/cache")
    .then(({ revalidatePath }) => {
      for (const p of paths) {
        try {
          revalidatePath(p);
        } catch {}
      }
    })
    .catch(() => {});
}

/* ─────────── live ranks ─────────── */

/** Recompute dailyRank / weeklyRank / monthlyRank in three set-based UPDATEs
 *  (one query per board instead of one per product). */
export async function syncLiveRanks(now = new Date()) {
  const boards: Array<[string, CycleRange]> = [
    ["dailyRank", getDailyCycleRange(now)],
    ["weeklyRank", getWeeklyCycleRange(now)],
    ["monthlyRank", getMonthlyCycleRange(now)],
  ];
  let changed = 0;
  for (const [column, range] of boards) {
    const col = Prisma.raw(`"${column}"`);
    changed += await prisma.$executeRaw`
      UPDATE "Product" AS p
         SET ${col} = r.rn
        FROM (
          SELECT "id", ROW_NUMBER() OVER (ORDER BY "voteCount" DESC, "launchedAt" DESC) AS rn
            FROM "Product"
           WHERE "status" = 'LIVE' AND "launchedAt" >= ${range.start} AND "launchedAt" < ${range.end}
        ) AS r
       WHERE p."id" = r."id" AND p.${col} IS DISTINCT FROM r.rn`;
  }
  return { changed };
}

/* ─────────── leaderboard cycle closer ─────────── */

type Period = "DAILY" | "WEEKLY" | "MONTHLY";

/**
 * Freeze the final top-10 of a completed cycle into RankSnapshot, then queue
 * the founder emails and the social announcement. Snapshot writes and job
 * enqueues share one transaction, so a crash can never leave a cycle
 * "closed" without its emails queued (or vice versa).
 */
async function closeCycle(period: Period, range: CycleRange) {
  const existing = await prisma.rankSnapshot.findFirst({
    where: { period, periodKey: range.key },
    select: { id: true },
  });
  if (existing) return { alreadyDone: true };

  const winners = await prisma.product.findMany({
    where: { status: "LIVE", launchedAt: { gte: range.start, lt: range.end } },
    orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
    take: 10,
    include: { owner: true },
  });
  if (winners.length === 0) return { alreadyDone: true, count: 0 };

  const lower = period.toLowerCase() as "daily" | "weekly" | "monthly";
  const title =
    period === "DAILY" ? `Daily Drop (${range.key})` : period === "WEEKLY" ? `Weekly (${range.key})` : `Monthly (${range.key})`;

  await prisma.$transaction(
    async (tx) => {
      for (let i = 0; i < winners.length; i++) {
        const p = winners[i];
        const rank = i + 1;
        await tx.rankSnapshot.upsert({
          where: { productId_period_periodKey: { productId: p.id, period, periodKey: range.key } },
          create: { productId: p.id, period, periodKey: range.key, rank, score: p.voteCount, voteCount: p.voteCount },
          update: { rank, score: p.voteCount, voteCount: p.voteCount },
        });
        if (rank <= 3 && !p.owner.isSeed) {
          const isFirst = rank === 1;
          await enqueue(
            "email.send.requested",
            {
              templateId: isFirst ? "rank-first" : "rank-top3",
              to: p.owner.email,
              toUserId: p.owner.id,
              trigger: isFirst ? "on-rank-first" : "on-rank-change",
              vars: {
                productName: p.name,
                productSlug: p.slug,
                userName: p.owner.name || p.owner.username,
                rank,
                period: lower,
              },
            },
            { dedupeKey: `rank-email:${period}:${range.key}:${p.id}` },
            tx
          );
        }
      }
      await enqueue(
        "broadcast.leaderboard",
        { period: lower, periodKey: range.key, periodTitle: title },
        { dedupeKey: `broadcast.leaderboard:${period}:${range.key}` },
        tx
      );
    },
    { timeout: 30_000 }
  );

  return { completed: true, count: winners.length };
}

/* ─────────── registry ─────────── */

export const registry: JobRegistry = {
  /* ── email dispatcher ── */
  "email.send.requested": {
    priority: 40,
    run: (d) => sendGated(d),
  },

  /* ── submission lifecycle ── */
  "submission.created": {
    priority: 40,
    run: async ({ submissionId }) => {
      const sub = await prisma.submission.findUnique({ where: { id: submissionId }, include: { owner: true } });
      if (!sub) return { skipped: true };
      return sendGated({
        templateId: "product-submitted",
        to: sub.makerEmail,
        toUserId: sub.ownerId,
        trigger: "on-submit",
        vars: {
          productName: sub.name,
          productSlug: slugify(sub.name),
          userName: sub.owner.name || sub.owner.username,
          slotExpiresOn: new Date(sub.scheduledFor).toISOString().slice(0, 10),
        },
      });
    },
  },

  "submission.rejected": {
    priority: 40,
    run: async ({ submissionId, reason }) => {
      const sub = await prisma.submission.findUnique({ where: { id: submissionId }, include: { owner: true } });
      if (!sub) return { skipped: true };
      return sendGated({
        templateId: "product-rejected",
        to: sub.makerEmail,
        toUserId: sub.ownerId,
        trigger: "on-reject",
        vars: {
          productName: sub.name,
          productSlug: slugify(sub.name),
          userName: sub.owner.name || sub.owner.username,
          rejectionReason: reason,
        },
      });
    },
  },

  /* ── launched: index + notify founder ── */
  "product.launched": {
    priority: 50,
    run: async ({ productId }) => {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { owner: true, category: true },
      });
      if (!product) return { skipped: true };

      const urls = [`${APP_URL()}/product/${encodeURIComponent(product.slug)}`, `${APP_URL()}/`];
      if (product.category?.slug) urls.push(`${APP_URL()}/category/${encodeURIComponent(product.category.slug)}`);
      if (product.owner?.username && product.owner.isProfilePublic) {
        urls.push(`${APP_URL()}/founder/${encodeURIComponent(product.owner.username.replace(/^@/, "").trim())}`);
      }
      await enqueue("indexing.submit.requested", { urls, type: "URL_UPDATED" }, { dedupeKey: `index-launch:${product.id}` });

      if (!product.owner.isSeed) {
        await enqueue(
          "email.send.requested",
          {
            templateId: "product-launched",
            to: product.owner.email,
            toUserId: product.owner.id,
            trigger: "on-launch",
            vars: {
              productName: product.name,
              productSlug: product.slug,
              userName: product.owner.name || product.owner.username,
            },
          },
          { dedupeKey: `launch-email:${product.id}` }
        );
      }
      return { queued: true };
    },
  },

  /* ── comments ── */
  "comment.posted": {
    priority: 30,
    run: async ({ commentId }) => {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: { product: { include: { owner: true } } },
      });
      if (!comment) return { skipped: true };
      if (comment.userId === comment.product.ownerId) return { skipped: true };
      return sendGated({
        templateId: "comment-received",
        to: comment.product.owner.email,
        toUserId: comment.product.owner.id,
        trigger: "on-comment",
        vars: {
          productName: comment.product.name,
          productSlug: comment.product.slug,
          userName: comment.product.owner.name || comment.product.owner.username,
        },
      });
    },
  },

  /* ── search indexing ── */
  "indexing.submit.requested": {
    priority: 10,
    run: async ({ urls, type }) => {
      if (!urls?.length) return { skipped: true };
      const { submitBatch } = await import("@/lib/indexing");
      return submitBatch(urls, { type });
    },
  },

  /* ── social broadcasts ── */
  "broadcast.launches": {
    priority: 45,
    maxAttempts: 3,
    run: async ({ productIds }) => {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { owner: true, category: true },
      });
      if (products.length === 0) return { skipped: true };
      const { broadcastProductLaunches } = await import("@/lib/broadcast");
      const log = await broadcastProductLaunches(
        products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          tagline: p.tagline,
          makerName: p.owner.name || p.owner.username,
          makerUsername: p.owner.username || undefined,
          category: p.category?.name || undefined,
          tags: p.tags,
          websiteUrl: p.websiteUrl,
        }))
      );
      return { id: log.id };
    },
  },

  "broadcast.leaderboard": {
    priority: 20,
    maxAttempts: 3,
    run: async ({ period, periodKey, periodTitle }) => {
      const rows = await prisma.rankSnapshot.findMany({
        where: { period: period.toUpperCase() as Period, periodKey, rank: { lte: 3 } },
        orderBy: { rank: "asc" },
        include: { product: { include: { owner: true } } },
      });
      if (rows.length === 0) return { skipped: true };
      const { broadcastLeaderboardWinners } = await import("@/lib/broadcast");
      const log = await broadcastLeaderboardWinners({
        period,
        periodTitle,
        winners: rows.map((r) => ({
          rank: r.rank,
          id: r.product.id,
          name: r.product.name,
          slug: r.product.slug,
          tagline: r.product.tagline,
          voteCount: r.voteCount,
          makerName: r.product.owner.name || r.product.owner.username,
          makerUsername: r.product.owner.username || undefined,
        })),
      });
      return { id: log.id };
    },
  },

  /* ── scheduled: publish due submissions (every minute) ── */
  "cron.publish-due": {
    priority: 100,
    maxAttempts: 2,
    run: async ({ slot }) => {
      const published: string[] = [];
      const errors: string[] = [];
      const seen = new Set<string>();
      for (let round = 0; round < 4; round++) {
        const due = await prisma.submission.findMany({
          where: { status: "SCHEDULED", scheduledFor: { lte: new Date() }, id: { notIn: [...seen] } },
          orderBy: { scheduledFor: "asc" },
          select: { id: true },
          take: 50,
        });
        if (due.length === 0) break;
        for (const { id } of due) {
          seen.add(id);
          try {
            const res = await publishSubmission(id);
            if (res.status === "published") published.push(res.productId);
          } catch (err) {
            // One bad submission must not block the rest of the launch batch;
            // it stays SCHEDULED and is retried on the next minute's tick.
            errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
            console.error(`[publish-due] ${id} failed:`, err);
          }
        }
      }

      if (published.length > 0) {
        // One combined broadcast for the whole batch; per-product launch jobs.
        await enqueue("broadcast.launches", { productIds: published }, { dedupeKey: `broadcast.launches:${slot}` });
        for (const pid of published) {
          await enqueue("product.launched", { productId: pid }, { dedupeKey: `product.launched:${pid}` });
        }
        revalidate(["/", "/founders", "/profile", "/admin"]);
      }
      if (errors.length > 0 && published.length === 0) {
        throw new Error(`publish failed for ${errors.length} submission(s): ${errors.slice(0, 3).join(" | ")}`);
      }
      return { published: published.length, errors };
    },
  },

  /* ── scheduled: ranks + cycle close (every 5 min) ── */
  "cron.leaderboard": {
    priority: 60,
    maxAttempts: 3,
    run: async () => {
      const now = new Date();
      const ranks = await syncLiveRanks(now);
      const daily = await closeCycle("DAILY", getPreviousDailyCycleRange(now));
      const weekly = await closeCycle("WEEKLY", getPreviousWeeklyCycleRange(now));
      const monthly = await closeCycle("MONTHLY", getPreviousMonthlyCycleRange(now));
      return { ranks, daily, weekly, monthly };
    },
  },

  /* ── scheduled: web indexing sync (every 6 h) ── */
  "cron.indexing-sync": {
    priority: 0,
    leaseMs: 10 * 60_000,
    maxAttempts: 2,
    run: async () => {
      const { syncDeployUrls } = await import("@/lib/indexing");
      return syncDeployUrls(200);
    },
  },

  /* ── scheduled: directory outreach (every 4 h) ── */
  "cron.outreach": {
    priority: -5,
    leaseMs: 15 * 60_000,
    maxAttempts: 2,
    run: async () => {
      const { triggerAutoOutreachBatchInternal } = await import("@/app/actions/leads");
      return triggerAutoOutreachBatchInternal();
    },
  },

  /* ── scheduled: directory crawler (hourly check, once per UTC day) ── */
  "cron.directory-crawler": {
    priority: -10,
    leaseMs: 20 * 60_000,
    maxAttempts: 2,
    run: async () => {
      const setting = await prisma.appSetting.findUnique({ where: { key: "auto_crawler_config" } });
      const config = setting?.value as { enabled?: boolean; scheduledTime?: string; selectedDirectoryIds?: string[] } | null;
      if (!config?.enabled) return { skipped: true, reason: "Auto-crawler is disabled in settings." };

      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const targetHour = parseInt((config.scheduledTime || "09:00").split(":")[0], 10) || 0;
      if (now.getUTCHours() < targetHour) {
        return { skipped: true, reason: `Waiting for ${targetHour}:00 UTC.` };
      }

      // Catch-up semantics: runs once per UTC day at the first tick at/after
      // the configured hour, so a missed heartbeat no longer skips a day.
      const state = await prisma.cronState.findUnique({ where: { name: "directory-crawler:last-day" } });
      if (state?.lastStatus === today) return { skipped: true, reason: `Already crawled ${today}.` };

      const { runDailyDirectoryCrawlBatchInternal } = await import("@/app/actions/leads");
      const result = await runDailyDirectoryCrawlBatchInternal(config.selectedDirectoryIds);
      await prisma.cronState.upsert({
        where: { name: "directory-crawler:last-day" },
        create: { name: "directory-crawler:last-day", lastStatus: today, lastRunAt: now },
        update: { lastStatus: today, lastRunAt: now },
      });
      return result;
    },
  },

  /* ── scheduled: free-launch badge audit (every 6 h, ~daily per domain) ── */
  "cron.badge-audit": {
    priority: -15,
    leaseMs: 20 * 60_000,
    maxAttempts: 2,
    run: async () => {
      const fl = await import("@/lib/free-launch");
      const products = await prisma.product.findMany({
        where: { status: "LIVE", details: { path: ["freeLaunch", "qualified"], equals: true } },
        select: { id: true, slug: true, websiteUrl: true, details: true },
      });
      const free = products.filter((p) => !fl.isPaidLaunch(p.details));
      const domains = [...new Set(free.map((p) => fl.normalizeDomain(p.websiteUrl)).filter(Boolean) as string[])];
      const rows = await prisma.badgeVerification.findMany({ where: { domain: { in: domains } } });
      const checkedAt = new Map(rows.map((r) => [r.domain, r.lastCheckedAt?.getTime() ?? 0]));
      const staleBefore = Date.now() - 20 * 60 * 60_000;
      const due = free
        .filter((p) => (checkedAt.get(fl.normalizeDomain(p.websiteUrl) || "") ?? 0) < staleBefore)
        .slice(0, 25);

      let kept = 0;
      let demoted = 0;
      const seenDomain = new Map<string, boolean>();
      for (const p of due) {
        const domain = fl.normalizeDomain(p.websiteUrl) || p.websiteUrl;
        let ok = seenDomain.get(domain);
        if (ok === undefined) {
          ok = (await fl.verifyBadge(p.websiteUrl)).verified;
          seenDomain.set(domain, ok);
        }
        const details = (p.details as Record<string, unknown>) || {};
        const rel = ok ? "dofollow" : "nofollow";
        if (details.backlinkRel !== rel) {
          await prisma.product.update({ where: { id: p.id }, data: { details: { ...details, backlinkRel: rel } as any } });
          revalidate([`/product/${p.slug}`]);
        }
        if (ok) kept++;
        else demoted++;
      }
      return { checked: due.length, kept, nofollow: demoted, freeProducts: free.length };
    },
  },

  /* ── scheduled: revenue re-verification (hourly; each key ~every 12 h) ── */
  "cron.revenue-sync": {
    priority: -12,
    leaseMs: 20 * 60_000,
    maxAttempts: 2,
    run: async () => {
      const { resyncConnection, scrubSecretsFromDetails } = await import("@/lib/revenue/store");
      const scrubbed = await scrubSecretsFromDetails();
      const due = await prisma.revenueConnection.findMany({
        where: {
          status: { in: ["ACTIVE", "ERROR", "EXPIRED"] },
          OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(Date.now() - 12 * 60 * 60_000) } }],
        },
        orderBy: { lastSyncedAt: "asc" },
        select: { id: true },
        take: 15,
      });
      const results: Record<string, number> = { ok: 0, credential: 0, unavailable: 0, other: 0 };
      for (const { id } of due) {
        try {
          const r = await resyncConnection(id);
          if ("ok" in r && r.ok) results.ok++;
          else if ("reason" in r && r.reason === "credential") results.credential++;
          else results.unavailable++;
        } catch (err) {
          results.other++;
          console.error(`[revenue-sync] ${id} failed:`, err instanceof Error ? err.message : err);
        }
      }
      return { checked: due.length, ...results, scrubbed };
    },
  },

  /* ── scheduled: outbound click rollup + raw retention (hourly) ── */
  "cron.outbound-rollup": {
    priority: -18,
    maxAttempts: 2,
    run: async () => {
      const { rollupAndPrune } = await import("@/lib/outbound/stats");
      return rollupAndPrune();
    },
  },

  /* ── scheduled: housekeeping (daily) ── */
  "cron.cleanup": {
    priority: -20,
    run: async () => {
      const day = 24 * 60 * 60_000;
      const done = await prisma.jobQueue.deleteMany({
        where: { status: "DONE", finishedAt: { lt: new Date(Date.now() - 7 * day) } },
      });
      const failed = await prisma.jobQueue.deleteMany({
        where: { status: "FAILED", finishedAt: { lt: new Date(Date.now() - 30 * day) } },
      });
      return { deletedDone: done.count, deletedFailed: failed.count };
    },
  },
};
