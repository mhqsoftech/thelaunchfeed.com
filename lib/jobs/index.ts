/**
 * Self-hosted background jobs — replaces Inngest. No third-party service,
 * no API keys: the queue lives in the app's own Postgres.
 *
 *   import { emit } from "@/lib/jobs";
 *   await emit("comment.posted", { commentId, productId });
 *
 * See lib/jobs/cron.ts for how scheduled work is triggered.
 */

export { emit, emitMany, enqueue, drainQueue, kick } from "./queue";
export { tick, heartbeat, scheduleDueCrons, getSchedulerStatus, CRON_TASKS } from "./cron";
export { sendAndLog, syncLiveRanks } from "./handlers";
export type { JobEvents, JobName } from "./events";
