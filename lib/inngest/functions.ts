/**
 * Inngest functions for The Launch Feed.
 *
 * Wire-up:
 *  - /api/inngest exposes these to Inngest (dev + cloud).
 *  - Server actions in app/actions/*.ts emit events; these subscribe.
 *  - RESEND_API_KEY drives real email delivery; without it, sends log to
 *    EmailLog with status=FAILED and errorMessage explaining the miss.
 *  - AutomationRule gates automatic sends (manual sends bypass the check).
 */

import { Resend } from "resend";
import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/db";
import { getTemplate, TemplateVars } from "@/app/admin/emailTemplates";
import { isAutomationEnabled } from "@/app/actions/automation";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "The Launch Feed <hi@thelaunchfeed.com>";

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
      data: {
        status: "FAILED",
        errorMessage: "RESEND_API_KEY not configured",
      },
    });
    return { id: log.id, delivered: false };
  }

  try {
    const res = await resend.emails.send({
      from: FROM,
      to: input.to,
      subject,
      html,
    });
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        providerId: res.data?.id,
        sentAt: new Date(),
      },
    });
    return { id: log.id, delivered: true };
  } catch (err) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    return { id: log.id, delivered: false };
  }
}

/* ─────────── email dispatcher ─────────── */

export const emailSend = inngest.createFunction(
  { id: "email-send", name: "Send email via Resend" },
  { event: "email.send.requested" },
  async ({ event, step }) => {
    const { templateId, to, toUserId, vars, trigger } = event.data;

    // Automation gating: manual / broadcast triggers bypass the rule.
    if (trigger && trigger !== "manual" && trigger !== "broadcast") {
      const enabled = await step.run("check-rule", () =>
        isAutomationEnabled(templateId)
      );
      if (!enabled) return { skipped: true };
    }

    return step.run("send", () =>
      sendAndLog({ templateId, to, toUserId, vars: vars as TemplateVars, trigger })
    );
  }
);

/* ─────────── submission lifecycle ─────────── */

export const onSubmissionCreated = inngest.createFunction(
  { id: "submission-created-email", name: "Notify founder of submission" },
  { event: "submission.created" },
  async ({ event, step }) => {
    const sub = await step.run("load", () =>
      prisma.submission.findUnique({
        where: { id: event.data.submissionId },
        include: { owner: true },
      })
    );
    if (!sub) return { skipped: true };
    await step.sendEvent("fan-out", {
      name: "email.send.requested",
      data: {
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
      },
    });
    return { ok: true };
  }
);

export const onSubmissionRejected = inngest.createFunction(
  { id: "submission-rejected-email", name: "Notify founder of rejection" },
  { event: "submission.rejected" },
  async ({ event, step }) => {
    const sub = await step.run("load", () =>
      prisma.submission.findUnique({
        where: { id: event.data.submissionId },
        include: { owner: true },
      })
    );
    if (!sub) return { skipped: true };
    await step.sendEvent("fan-out", {
      name: "email.send.requested",
      data: {
        templateId: "product-rejected",
        to: sub.makerEmail,
        toUserId: sub.ownerId,
        trigger: "on-reject",
        vars: {
          productName: sub.name,
          productSlug: slugify(sub.name),
          userName: sub.owner.name || sub.owner.username,
          rejectionReason: event.data.reason,
        },
      },
    });
    return { ok: true };
  }
);

/**
 * Scheduled publish cron — runs every minute.
 * Finds SCHEDULED submissions where scheduledFor <= now, creates a Product,
 * links back, and fires `product.launched` which fans out launch emails.
 */
export const publishDue = inngest.createFunction(
  { id: "publish-due-submissions", name: "Publish due submissions" },
  { cron: "* * * * *" },
  async ({ step }) => {
    const due = (await step.run("fetch-due", () =>
      prisma.submission.findMany({
        where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
        take: 50,
      })
    )) as unknown as Awaited<ReturnType<typeof prisma.submission.findMany>>;
    if (!due || due.length === 0) return { published: 0 };

    const now = new Date();
    const publishedIds: string[] = [];
    for (const sub of due) {
      await step.run(`publish-${sub.id}`, async () => {
        const product = await prisma.product.create({
          data: {
            slug: await ensureUniqueSlug(slugify(sub.name)),
            name: sub.name,
            tagline: sub.tagline,
            description: sub.description,
            websiteUrl: sub.websiteUrl,
            logoUrl: sub.logoUrl,
            screenshots: sub.screenshots,
            videoUrl: sub.videoUrl,
            tags: sub.tags,
            categoryId: sub.categoryId,
            ownerId: sub.ownerId,
            status: "LIVE",
            launchedAt: now,
            voteCount: 1,
            details: (sub.details as any) ?? undefined,
          },
        });
        await prisma.productMaker.create({
          data: {
            productId: product.id,
            userId: sub.ownerId,
            role: "maker",
          },
        }).catch(() => {});
        await prisma.vote.create({
          data: {
            productId: product.id,
            userId: sub.ownerId,
          },
        });
        await prisma.submission.update({
          where: { id: sub.id },
          data: {
            status: "PUBLISHED",
            publishedAt: now,
            publishedProductId: product.id,
          },
        });
        publishedIds.push(product.id);
      });
    }

    // Broadcast a launch email per newly-published product to every user.
    for (const pid of publishedIds) {
      await step.sendEvent(`launched-${pid}`, {
        name: "product.launched",
        data: { productId: pid },
      });
    }
    return { published: publishedIds.length };
  }
);

export const onProductLaunched = inngest.createFunction(
  { id: "product-launched-broadcast", name: "Broadcast launch to all users" },
  { event: "product.launched" },
  async ({ event, step }) => {
    const product = await step.run("load-product", () =>
      prisma.product.findUnique({
        where: { id: event.data.productId },
        include: { owner: true, category: true },
      })
    );
    if (!product) return { skipped: true };

    // Multi-channel social broadcast (X, Telegram, WhatsApp)
    await step.run("social-broadcast", async () => {
      try {
        const { broadcastProductLaunch } = await import("@/lib/broadcast");
        await broadcastProductLaunch({
          id: product.id,
          name: product.name,
          slug: product.slug,
          tagline: product.tagline,
          makerName: product.owner.name || product.owner.username,
          makerHandle: product.owner.username ? `@${product.owner.username}` : undefined,
          category: product.category?.name || undefined,
          tags: product.tags,
          websiteUrl: product.websiteUrl,
        });
      } catch (err) {
        console.error("[social-broadcast] failed:", err);
      }
    });

    const vars: TemplateVars = {
      productName: product.name,
      productSlug: product.slug,
      userName: product.owner.name || product.owner.username,
    };

    // 1. Founder-first: dedicated launch notification to the maker (unless seed).
    if (!product.owner.isSeed) {
      await step.sendEvent("notify-founder", {
        name: "email.send.requested",
        data: {
          templateId: "product-launched",
          to: product.owner.email,
          toUserId: product.owner.id,
          trigger: "on-launch",
          vars,
        },
      });
    }

    // 2. Broadcast to every real user (excluding seeds and the founder we already emailed).
    const users = await step.run("load-users", () =>
      prisma.user.findMany({
        where: { isSeed: false, id: { not: product.owner.id } },
        select: { id: true, email: true },
      })
    );

    if (users.length > 0) {
      await step.sendEvent(
        "fan-out",
        users.map((u) => ({
          name: "email.send.requested" as const,
          data: {
            templateId: "product-launched",
            to: u.email,
            toUserId: u.id,
            trigger: "on-launch",
            vars,
          },
        }))
      );
    }
    return { queued: users.length + 1 };
  }
);

/* ─────────── comment notifications ─────────── */

export const onCommentPosted = inngest.createFunction(
  { id: "comment-posted-notify", name: "Notify founder of new comment" },
  { event: "comment.posted" },
  async ({ event, step }) => {
    const comment = await step.run("load", () =>
      prisma.comment.findUnique({
        where: { id: event.data.commentId },
        include: {
          product: { include: { owner: true } },
          user: true,
        },
      })
    );
    if (!comment) return { skipped: true };
    // Don't notify the founder about their own comments.
    if (comment.userId === comment.product.ownerId) return { skipped: true };

    await step.sendEvent("send", {
      name: "email.send.requested",
      data: {
        templateId: "comment-received",
        to: comment.product.owner.email,
        toUserId: comment.product.owner.id,
        trigger: "on-comment",
        vars: {
          productName: comment.product.name,
          productSlug: comment.product.slug,
          userName: comment.product.owner.name || comment.product.owner.username,
        },
      },
    });
    return { ok: true };
  }
);

import {
  getDailyCycleRange,
  getPreviousDailyCycleRange,
  getWeeklyCycleRange,
  getPreviousWeeklyCycleRange,
  getMonthlyCycleRange,
  getPreviousMonthlyCycleRange,
} from "@/lib/schedule";
import { broadcastLeaderboardWinners } from "@/lib/broadcast";

/* ─────────── live rank synchronizer ─────────── */

/**
 * Synchronizes real-time dailyRank, weeklyRank, and monthlyRank fields on Product rows.
 */
export async function syncLiveRanks() {
  const now = new Date();
  const daily = getDailyCycleRange(now);
  const weekly = getWeeklyCycleRange(now);
  const monthly = getMonthlyCycleRange(now);

  // 1. Daily Ranks for active 24h cycle
  const dailyProds = await prisma.product.findMany({
    where: { status: "LIVE", launchedAt: { gte: daily.start, lt: daily.end } },
    orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
    select: { id: true },
  });
  for (let i = 0; i < dailyProds.length; i++) {
    await prisma.product.update({
      where: { id: dailyProds[i].id },
      data: { dailyRank: i + 1 },
    });
  }

  // 2. Weekly Ranks for active week
  const weeklyProds = await prisma.product.findMany({
    where: { status: "LIVE", launchedAt: { gte: weekly.start, lt: weekly.end } },
    orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
    select: { id: true },
  });
  for (let i = 0; i < weeklyProds.length; i++) {
    await prisma.product.update({
      where: { id: weeklyProds[i].id },
      data: { weeklyRank: i + 1 },
    });
  }

  // 3. Monthly Ranks for active month
  const monthlyProds = await prisma.product.findMany({
    where: { status: "LIVE", launchedAt: { gte: monthly.start, lt: monthly.end } },
    orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
    select: { id: true },
  });
  for (let i = 0; i < monthlyProds.length; i++) {
    await prisma.product.update({
      where: { id: monthlyProds[i].id },
      data: { monthlyRank: i + 1 },
    });
  }
}

/* ─────────── automated cycle closer, award granter & broadcaster ─────────── */

/**
 * Runs periodically to evaluate completed Daily, Weekly, and Monthly cycles:
 * 1. Freezes final rankings for completed cycles in RankSnapshot table
 * 2. Awards top-3 badges to winners
 * 3. Sends automatic founder email notifications (rank-first / rank-top3)
 * 4. Automatically announces top-3 winners to WhatsApp, X (Twitter), Telegram, and Webhooks
 */
export const evaluateLeaderboardCycles = inngest.createFunction(
  { id: "evaluate-leaderboard-cycles", name: "Evaluate completed leaderboard cycles & announce winners" },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    // 1. Sync live ranks first
    await step.run("sync-live-ranks", () => syncLiveRanks());

    const now = new Date();
    const prevDaily = getPreviousDailyCycleRange(now);
    const prevWeekly = getPreviousWeeklyCycleRange(now);
    const prevMonthly = getPreviousMonthlyCycleRange(now);

    // ── A. DAILY CYCLE COMPLETION ──
    const dailyProcessed = await step.run("check-prev-daily", async () => {
      const existing = await prisma.rankSnapshot.findFirst({
        where: { period: "DAILY", periodKey: prevDaily.key },
      });
      if (existing) return { alreadyDone: true };

      const winners = await prisma.product.findMany({
        where: { status: "LIVE", launchedAt: { gte: prevDaily.start, lt: prevDaily.end } },
        orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
        take: 10,
        include: { owner: true },
      });

      if (winners.length === 0) return { alreadyDone: true, count: 0 };

      // Record snapshots for top finishers
      for (let i = 0; i < winners.length; i++) {
        const p = winners[i];
        const rank = i + 1;
        await prisma.rankSnapshot.upsert({
          where: {
            productId_period_periodKey: {
              productId: p.id,
              period: "DAILY",
              periodKey: prevDaily.key,
            },
          },
          create: {
            productId: p.id,
            period: "DAILY",
            periodKey: prevDaily.key,
            rank,
            score: p.voteCount,
            voteCount: p.voteCount,
          },
          update: { rank, score: p.voteCount, voteCount: p.voteCount },
        });

        // If in top 3, send winner email to founder
        if (rank <= 3) {
          const isFirst = rank === 1;
          await sendAndLog({
            templateId: isFirst ? "rank-first" : "rank-top3",
            to: p.owner.email,
            toUserId: p.owner.id,
            trigger: isFirst ? "on-rank-first" : "on-rank-change",
            vars: {
              productName: p.name,
              productSlug: p.slug,
              userName: p.owner.name || p.owner.username,
              rank,
              period: "daily",
            },
          });
        }
      }

      // Broadcast top 3 to WhatsApp, X, Telegram, and Webhook
      const top3 = winners.slice(0, 3).map((w, idx) => ({
        rank: idx + 1,
        id: w.id,
        name: w.name,
        slug: w.slug,
        tagline: w.tagline,
        voteCount: w.voteCount,
        makerName: w.owner.name || w.owner.username,
        makerHandle: w.owner.username ? `@${w.owner.username}` : undefined,
      }));

      await broadcastLeaderboardWinners({
        period: "daily",
        periodTitle: `Daily Drop (${prevDaily.key})`,
        winners: top3,
      });

      return { completed: true, count: winners.length };
    });

    // ── B. WEEKLY CYCLE COMPLETION ──
    const weeklyProcessed = await step.run("check-prev-weekly", async () => {
      const existing = await prisma.rankSnapshot.findFirst({
        where: { period: "WEEKLY", periodKey: prevWeekly.key },
      });
      if (existing) return { alreadyDone: true };

      const winners = await prisma.product.findMany({
        where: { status: "LIVE", launchedAt: { gte: prevWeekly.start, lt: prevWeekly.end } },
        orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
        take: 10,
        include: { owner: true },
      });

      if (winners.length === 0) return { alreadyDone: true, count: 0 };

      for (let i = 0; i < winners.length; i++) {
        const p = winners[i];
        const rank = i + 1;
        await prisma.rankSnapshot.upsert({
          where: {
            productId_period_periodKey: {
              productId: p.id,
              period: "WEEKLY",
              periodKey: prevWeekly.key,
            },
          },
          create: {
            productId: p.id,
            period: "WEEKLY",
            periodKey: prevWeekly.key,
            rank,
            score: p.voteCount,
            voteCount: p.voteCount,
          },
          update: { rank, score: p.voteCount, voteCount: p.voteCount },
        });

        if (rank <= 3) {
          const isFirst = rank === 1;
          await sendAndLog({
            templateId: isFirst ? "rank-first" : "rank-top3",
            to: p.owner.email,
            toUserId: p.owner.id,
            trigger: isFirst ? "on-rank-first" : "on-rank-change",
            vars: {
              productName: p.name,
              productSlug: p.slug,
              userName: p.owner.name || p.owner.username,
              rank,
              period: "weekly",
            },
          });
        }
      }

      const top3 = winners.slice(0, 3).map((w, idx) => ({
        rank: idx + 1,
        id: w.id,
        name: w.name,
        slug: w.slug,
        tagline: w.tagline,
        voteCount: w.voteCount,
        makerName: w.owner.name || w.owner.username,
        makerHandle: w.owner.username ? `@${w.owner.username}` : undefined,
      }));

      await broadcastLeaderboardWinners({
        period: "weekly",
        periodTitle: `Weekly (${prevWeekly.key})`,
        winners: top3,
      });

      return { completed: true, count: winners.length };
    });

    // ── C. MONTHLY CYCLE COMPLETION ──
    const monthlyProcessed = await step.run("check-prev-monthly", async () => {
      const existing = await prisma.rankSnapshot.findFirst({
        where: { period: "MONTHLY", periodKey: prevMonthly.key },
      });
      if (existing) return { alreadyDone: true };

      const winners = await prisma.product.findMany({
        where: { status: "LIVE", launchedAt: { gte: prevMonthly.start, lt: prevMonthly.end } },
        orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
        take: 10,
        include: { owner: true },
      });

      if (winners.length === 0) return { alreadyDone: true, count: 0 };

      for (let i = 0; i < winners.length; i++) {
        const p = winners[i];
        const rank = i + 1;
        await prisma.rankSnapshot.upsert({
          where: {
            productId_period_periodKey: {
              productId: p.id,
              period: "MONTHLY",
              periodKey: prevMonthly.key,
            },
          },
          create: {
            productId: p.id,
            period: "MONTHLY",
            periodKey: prevMonthly.key,
            rank,
            score: p.voteCount,
            voteCount: p.voteCount,
          },
          update: { rank, score: p.voteCount, voteCount: p.voteCount },
        });

        if (rank <= 3 && !p.owner.isSeed) {
          const isFirst = rank === 1;
          await sendAndLog({
            templateId: isFirst ? "rank-first" : "rank-top3",
            to: p.owner.email,
            toUserId: p.owner.id,
            trigger: isFirst ? "on-rank-first" : "on-rank-change",
            vars: {
              productName: p.name,
              productSlug: p.slug,
              userName: p.owner.name || p.owner.username,
              rank,
              period: "monthly",
            },
          });
        }
      }

      const top3 = winners.slice(0, 3).map((w, idx) => ({
        rank: idx + 1,
        id: w.id,
        name: w.name,
        slug: w.slug,
        tagline: w.tagline,
        voteCount: w.voteCount,
        makerName: w.owner.name || w.owner.username,
        makerHandle: w.owner.username ? `@${w.owner.username}` : undefined,
      }));

      await broadcastLeaderboardWinners({
        period: "monthly",
        periodTitle: `Monthly (${prevMonthly.key})`,
        winners: top3,
      });

      return { completed: true, count: winners.length };
    });

    return { daily: dailyProcessed, weekly: weeklyProcessed, monthly: monthlyProcessed };
  }
);

/* ─────────── util ─────────── */

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || `p-${Date.now().toString(36)}`;
  for (let i = 0; i < 20; i++) {
    const clash = await prisma.product.findUnique({ where: { slug } });
    if (!clash) return slug;
    slug = `${base}-${Math.floor(Math.random() * 9000) + 1000}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ─────────── registry ─────────── */

export const functions = [
  emailSend,
  onSubmissionCreated,
  onSubmissionRejected,
  publishDue,
  onProductLaunched,
  onCommentPosted,
  evaluateLeaderboardCycles,
];

