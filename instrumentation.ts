/**
 * In-process scheduler for long-running Node servers (VPS, Docker, Railway,
 * `next start`, and `next dev` when JOBS_INPROCESS=true).
 *
 * Serverless hosts (Vercel / Lambda / Netlify) freeze the process between
 * requests, so there the scheduler is driven by /api/cron pingers and the
 * visitor-traffic heartbeat instead — see lib/jobs/cron.ts.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.JOBS_DISABLED === "true") return;

  const serverless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT
  );
  const flag = process.env.JOBS_INPROCESS;
  const enabled = flag ? flag === "true" : !serverless && process.env.NODE_ENV === "production";
  if (!enabled) return;

  const g = globalThis as unknown as { __launchfeedScheduler?: ReturnType<typeof setInterval> };
  if (g.__launchfeedScheduler) return;

  const { tick } = await import("./lib/jobs");
  const run = () => tick("in-process", 50_000).catch((err) => console.error("[jobs] in-process tick failed:", err));
  g.__launchfeedScheduler = setInterval(run, 60_000);
  g.__launchfeedScheduler.unref?.();
  setTimeout(run, 5_000).unref?.();
  console.info("[jobs] in-process scheduler started (60s interval)");
}
