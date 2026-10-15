/**
 * Durable Postgres job queue — the engine behind lib/jobs.
 *
 *   emit(name, data)  → INSERT a JobQueue row, then drain it right after the
 *                       current response via next/server `after()`.
 *   drainQueue()      → claim due rows one at a time with
 *                       `FOR UPDATE SKIP LOCKED`, run the handler, mark DONE
 *                       or reschedule with exponential backoff.
 *
 * Guarantees:
 *  - At-least-once execution. A runner that dies mid-job leaves a lease
 *    (`lockedUntil`) that expires, after which any other runner retakes it.
 *  - No double execution while a lease is live — SKIP LOCKED + the lease
 *    make concurrent drains (cron + traffic + after()) safe.
 *  - Optional `dedupeKey` makes an enqueue idempotent (ON CONFLICT DO NOTHING).
 */

import { after } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { ensureJobTables } from "./schema";
import type { JobEvents, JobName } from "./events";

export interface EnqueueOptions {
  /** Idempotency key — a second enqueue with the same key is a no-op. */
  dedupeKey?: string;
  /** Earliest time the job may run (default: now). */
  runAt?: Date;
  /** Higher runs first (default from the handler definition, else 0). */
  priority?: number;
  maxAttempts?: number;
}

type TxClient = Prisma.TransactionClient;

export type JobDefinition<N extends JobName = JobName> = {
  run: (payload: JobEvents[N]) => Promise<unknown>;
  /** How long a claim is held before another runner may retake it. */
  leaseMs?: number;
  priority?: number;
  maxAttempts?: number;
};

export type JobRegistry = { [N in JobName]?: JobDefinition<N> };

async function getRegistry(): Promise<JobRegistry> {
  const mod = await import("./handlers");
  return mod.registry;
}

/* ─────────── enqueue ─────────── */

export async function enqueue<N extends JobName>(
  name: N,
  payload: JobEvents[N],
  opts: EnqueueOptions = {},
  db: TxClient | typeof prisma = prisma
): Promise<void> {
  await ensureJobTables();
  const reg = await getRegistry();
  const def = reg[name] as JobDefinition | undefined;
  await db.jobQueue.createMany({
    data: [
      {
        name,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
        priority: opts.priority ?? def?.priority ?? 0,
        maxAttempts: opts.maxAttempts ?? def?.maxAttempts ?? 5,
        runAt: opts.runAt ?? new Date(),
        dedupeKey: opts.dedupeKey ?? null,
      },
    ],
    skipDuplicates: true,
  });
}

/** Bulk enqueue (e.g. an admin broadcast to every user), then drain. */
export async function emitMany<N extends JobName>(
  name: N,
  payloads: JobEvents[N][],
  opts: Omit<EnqueueOptions, "dedupeKey"> = {}
): Promise<number> {
  if (payloads.length === 0) return 0;
  await ensureJobTables();
  const def = (await getRegistry())[name] as JobDefinition | undefined;
  const runAt = opts.runAt ?? new Date();
  let created = 0;
  for (let i = 0; i < payloads.length; i += 500) {
    const res = await prisma.jobQueue.createMany({
      data: payloads.slice(i, i + 500).map((payload) => ({
        name,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
        priority: opts.priority ?? def?.priority ?? 0,
        maxAttempts: opts.maxAttempts ?? def?.maxAttempts ?? 5,
        runAt,
      })),
    });
    created += res.count;
  }
  kick();
  return created;
}

/**
 * Enqueue an event and process it as soon as the current response is sent.
 * Never throws — a failed enqueue is logged so a user-facing action is
 * never broken by background work.
 */
export async function emit<N extends JobName>(
  name: N,
  payload: JobEvents[N],
  opts: EnqueueOptions = {}
): Promise<boolean> {
  try {
    await enqueue(name, payload, opts);
    kick();
    return true;
  } catch (err) {
    console.error(`[jobs] emit(${name}) failed:`, err);
    return false;
  }
}

/** Schedule a queue drain after the current response (or immediately when
 *  called outside a request, e.g. from the in-process timer). */
export function kick(budgetMs = 20_000) {
  const run = () =>
    drainQueue({ budgetMs }).catch((err) => console.error("[jobs] drain failed:", err));
  try {
    after(run);
  } catch {
    void run();
  }
}

/* ─────────── drain ─────────── */

export interface DrainResult {
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
}

type ClaimedRow = {
  id: string;
  name: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

const DEFAULT_LEASE_MS = 5 * 60_000;

async function claimNext(now: Date): Promise<ClaimedRow | null> {
  const lease = new Date(now.getTime() + DEFAULT_LEASE_MS);
  const rows = await prisma.$queryRaw<ClaimedRow[]>`
    UPDATE "JobQueue"
       SET "status" = 'RUNNING',
           "attempts" = "attempts" + 1,
           "lockedUntil" = ${lease},
           "updatedAt" = ${now}
     WHERE "id" = (
       SELECT "id" FROM "JobQueue"
        WHERE ("status" = 'PENDING' AND "runAt" <= ${now})
           OR ("status" = 'RUNNING' AND "lockedUntil" < ${now})
        ORDER BY "priority" DESC, "runAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     RETURNING "id", "name", "payload", "attempts", "maxAttempts"`;
  return rows[0] ?? null;
}

function backoffMs(attempt: number) {
  const base = Math.min(60 * 60_000, 15_000 * 2 ** Math.max(0, attempt - 1));
  return base + Math.floor(Math.random() * 5_000);
}

function errText(err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  return msg.slice(0, 4_000);
}

async function runOne(job: ClaimedRow, reg: JobRegistry): Promise<"ok" | "retry" | "failed"> {
  const def = reg[job.name as JobName] as JobDefinition | undefined;
  const now = () => new Date();

  if (!def) {
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: `No handler registered for "${job.name}"`, lockedUntil: null, finishedAt: now() },
    });
    return "failed";
  }

  if (job.attempts > job.maxAttempts) {
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: "Max attempts exceeded (lease expired repeatedly)", lockedUntil: null, finishedAt: now() },
    });
    return "failed";
  }

  if (def.leaseMs && def.leaseMs !== DEFAULT_LEASE_MS) {
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: { lockedUntil: new Date(Date.now() + def.leaseMs) },
    });
  }

  try {
    const result = await def.run(job.payload as never);
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: {
        status: "DONE",
        result: toJson(result),
        lastError: null,
        lockedUntil: null,
        finishedAt: now(),
      },
    });
    return "ok";
  } catch (err) {
    const exhausted = job.attempts >= job.maxAttempts;
    console.error(`[jobs] ${job.name} (${job.id}) attempt ${job.attempts}/${job.maxAttempts} failed:`, err);
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: exhausted
        ? { status: "FAILED", lastError: errText(err), lockedUntil: null, finishedAt: now() }
        : {
            status: "PENDING",
            lastError: errText(err),
            lockedUntil: null,
            runAt: new Date(Date.now() + backoffMs(job.attempts)),
          },
    });
    return exhausted ? "failed" : "retry";
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    const text = JSON.stringify(value);
    if (text.length > 20_000) return { truncated: true } as Prisma.InputJsonValue;
    return JSON.parse(text) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

let activeDrain: Promise<DrainResult> | null = null;
let drainAgain = false;

/**
 * Process due jobs until the queue is empty or `budgetMs` is spent.
 * Concurrent calls in the same process coalesce into one loop.
 */
export function drainQueue(opts: { budgetMs?: number } = {}): Promise<DrainResult> {
  if (activeDrain) {
    drainAgain = true;
    return activeDrain;
  }
  const budgetMs = opts.budgetMs ?? 20_000;
  activeDrain = (async () => {
    const totals: DrainResult = { processed: 0, succeeded: 0, failed: 0, retried: 0 };
    await ensureJobTables();
    const reg = await getRegistry();
    const deadline = Date.now() + budgetMs;
    do {
      drainAgain = false;
      while (Date.now() < deadline) {
        const job = await claimNext(new Date());
        if (!job) break;
        const outcome = await runOne(job, reg);
        totals.processed++;
        if (outcome === "ok") totals.succeeded++;
        else if (outcome === "retry") totals.retried++;
        else totals.failed++;
      }
    } while (drainAgain && Date.now() < deadline);
    return totals;
  })().finally(() => {
    activeDrain = null;
  });
  return activeDrain;
}
