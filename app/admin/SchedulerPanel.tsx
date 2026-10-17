"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { getSchedulerStatusAction, runSchedulerNowAction, retryFailedJobAction } from "@/app/actions/automation";
import * as ui from "./ui";

type Status = Awaited<ReturnType<typeof getSchedulerStatusAction>>;

function ago(iso: string | null) {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function every(min: number) {
  return min < 60 ? `every ${min} min` : min < 1440 ? `every ${min / 60} h` : "daily";
}

/** Live health of the self-hosted scheduler (lib/jobs) — replaces the Inngest dashboard. */
export default function SchedulerPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      setStatus(await getSchedulerStatusAction());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const runNow = () =>
    startTransition(async () => {
      try {
        const r = await runSchedulerNowAction();
        setMessage(`Ran ${r.drained.processed} job(s) in ${(r.durationMs / 1000).toFixed(1)}s`);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
      }
      await refresh();
    });

  const retry = (id: string) =>
    startTransition(async () => {
      await retryFailedJobAction(id);
      await refresh();
    });

  if (error) {
    return <div className="rounded-xl border border-hairline bg-card shadow-card p-4 text-xs text-red-500">Scheduler status unavailable: {error}</div>;
  }
  if (!status) {
    return <div className="rounded-xl border border-hairline bg-card shadow-card p-4 text-xs text-ink-dim">Loading scheduler health…</div>;
  }

  return (
    <section className="rounded-xl border border-hairline bg-card shadow-card overflow-hidden" aria-labelledby="scheduler-heading">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-hairline">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${status.healthy ? "bg-emerald-500" : "bg-amber-500"}`}
            aria-hidden
          />
          <h3 id="scheduler-heading" className="text-sm font-bold text-ink">
            Scheduler {status.healthy ? "healthy" : "idle"}
          </h3>
          <span className="text-xs text-ink-dim">
            last heartbeat {ago(status.lastTickAt)}
            {status.lastTickSource ? ` · via ${status.lastTickSource}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-dim tabular-nums">
            {status.queue.PENDING ?? 0} pending · {status.queue.RUNNING ?? 0} running · {status.queue.FAILED ?? 0} failed
          </span>
          <button
            type="button"
            onClick={runNow}
            disabled={pending}
            className={ui.cx(ui.btn, ui.secondary)}
          >
            {pending ? "Running…" : "Run now"}
          </button>
        </div>
      </header>

      {!status.healthy && (
        <p className="px-4 py-2 text-xs text-amber-600 border-b border-hairline">
          No heartbeat in the last 10 minutes. Jobs still run on visitor traffic, but for on-time launches
          deploy the free Cloudflare Worker pinger in <code>workers/scheduler-heartbeat</code>.
        </p>
      )}
      {message && <p className="px-4 py-2 text-xs text-ink-dim border-b border-hairline">{message}</p>}

      <div className="overflow-x-auto">
        <table className={ui.cx(ui.table, "min-w-[640px]")}>
          <thead>
            <tr className="">
              <th className={ui.th}>Task</th>
              <th className={ui.th}>Schedule</th>
              <th className={ui.th}>Last run</th>
              <th className={ui.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {status.tasks.map((t) => (
              <tr key={t.job} className={ui.tr}>
                <td className={ui.td}>
                  <div className="font-bold text-ink">{t.job.replace("cron.", "")}</div>
                  <div className="text-xs text-ink-dim">{t.description}</div>
                </td>
                <td className={ui.cx(ui.td, "text-xs text-ink-dim whitespace-nowrap")}>{every(t.everyMinutes)}</td>
                <td className={ui.cx(ui.td, "text-xs text-ink-dim whitespace-nowrap")}>{ago(t.lastFinishedAt)}</td>
                <td className={ui.cx(ui.td, "text-xs")}>
                  {t.lastStatus === "DONE" && <span className="text-emerald-600 font-bold">OK</span>}
                  {t.lastStatus === "FAILED" && (
                    <span className="text-red-500 font-bold" title={t.lastError ?? ""}>
                      Failed
                    </span>
                  )}
                  {!t.lastStatus && <span className="text-ink-dim">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status.recentFailures.length > 0 && (
        <div className="border-t border-hairline px-4 py-3 space-y-2">
          <h4 className="text-xs font-bold uppercase text-ink-dim">Recent failures</h4>
          {status.recentFailures.map((f) => (
            <div key={f.id} className="flex items-start justify-between gap-3 text-xs">
              <div className="min-w-0">
                <span className="font-bold text-ink">{f.name}</span>{" "}
                <span className="text-ink-dim">
                  · {f.attempts} attempt(s) · {ago(f.finishedAt ? new Date(f.finishedAt).toISOString() : null)}
                </span>
                <div className="text-red-500 truncate">{f.lastError?.split("\n")[0]}</div>
              </div>
              <button
                type="button"
                onClick={() => retry(f.id)}
                disabled={pending}
                className={ui.cx(ui.btnSm, ui.secondary, "shrink-0")}
              >
                Retry
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
