import { Inngest, EventSchemas } from "inngest";

/* ─────────── event contracts ─────────── */

type Events = {
  "submission.created": { data: { submissionId: string } };
  "submission.publish.request": { data: { submissionId: string } };
  "submission.rejected": { data: { submissionId: string; reason: string } };
  "product.launched": { data: { productId: string; submissionId?: string } };
  "email.send.requested": {
    data: {
      templateId: string;
      to: string;
      toUserId?: string;
      vars?: Record<string, unknown>;
      actorId?: string;
      trigger?: string;
    };
  };
  "comment.posted": { data: { commentId: string; productId: string } };
  "rank.snapshot.written": {
    data: {
      productId: string;
      period: "DAILY" | "WEEKLY" | "MONTHLY";
      newRank: number;
      previousRank: number | null;
    };
  };
  "indexing.submit.requested": {
    data: {
      urls: string[];
      type?: "URL_UPDATED" | "URL_DELETED";
    };
  };
  "indexing.sync.requested": {
    data?: {
      limit?: number;
    };
  };
};

export const inngest = new Inngest({
  id: "the-launch-feed",
  schemas: new EventSchemas().fromRecord<Events>(),
});
