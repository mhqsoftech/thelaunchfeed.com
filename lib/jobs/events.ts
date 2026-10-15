/**
 * Job / event contracts. Same event names the app used with Inngest, plus
 * the internal jobs the scheduler fans out to.
 */

export type JobEvents = {
  /* app events */
  "submission.created": { submissionId: string };
  "submission.rejected": { submissionId: string; reason: string };
  "product.launched": { productId: string };
  "comment.posted": { commentId: string; productId: string };
  "email.send.requested": {
    templateId: string;
    to: string;
    toUserId?: string;
    vars?: Record<string, unknown>;
    actorId?: string;
    trigger?: string;
  };
  "indexing.submit.requested": { urls: string[]; type?: "URL_UPDATED" | "URL_DELETED" };

  /* fan-out jobs */
  "broadcast.launches": { productIds: string[] };
  "broadcast.leaderboard": { period: "daily" | "weekly" | "monthly"; periodKey: string; periodTitle: string };

  /* scheduled tasks (enqueued by the cron registry) */
  "cron.publish-due": { slot: string };
  "cron.leaderboard": { slot: string };
  "cron.indexing-sync": { slot: string };
  "cron.outreach": { slot: string };
  "cron.directory-crawler": { slot: string };
  "cron.cleanup": { slot: string };
  "cron.badge-audit": { slot: string };
  "cron.revenue-sync": { slot: string };
  "cron.outbound-rollup": { slot: string };
};

export type JobName = keyof JobEvents;
