"use client";

import React from "react";
import type { VisitorStats } from "@/lib/outbound/stats";
import { SENT_SOURCES, SOURCE_LABELS } from "@/lib/outbound/links";

const fmt = (n: number) => n.toLocaleString("en-US");

function shortDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** 30 daily bars; each bar has a native hover tooltip with its exact count. */
function Sparkline({ daily }: { daily: VisitorStats["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.visitors));
  const W = 4;
  const GAP = 2;
  const H = 32;
  const width = daily.length * (W + GAP) - GAP;
  const summary = `Daily visitors, ${shortDay(daily[0].day)} to ${shortDay(daily[daily.length - 1].day)}: peak ${fmt(max)}`;
  return (
    <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="img" aria-label={summary} className="block text-signal">
      <line x1={0} x2={width} y1={H - 0.5} y2={H - 0.5} stroke="var(--color-hairline)" strokeWidth={1} />
      {daily.map((d, i) => {
        const h = d.visitors === 0 ? 0 : Math.max(2, Math.round((d.visitors / max) * (H - 2)));
        return (
          <g key={d.day}>
            <title>{`${shortDay(d.day)} · ${fmt(d.visitors)} visitor${d.visitors === 1 ? "" : "s"}`}</title>
            {/* full-height hit target so empty days still show a tooltip */}
            <rect x={i * (W + GAP) - GAP / 2} y={0} width={W + GAP} height={H} fill="transparent" />
            {h > 0 && <rect x={i * (W + GAP)} y={H - 1 - h} width={W} height={h} rx={1} fill="currentColor" />}
          </g>
        );
      })}
    </svg>
  );
}

export function VisitorsSentCard({ stats, loading }: { stats?: VisitorStats; loading?: boolean }) {
  if (loading && !stats) {
    return <div className="h-[92px] rounded-xl border border-hairline bg-surface/40 animate-pulse" aria-hidden />;
  }
  if (!stats) return null;

  const sources = SENT_SOURCES.map((s) => ({ s, n: stats.bySource[s] ?? 0 })).filter((x) => x.n > 0);
  const top = Math.max(1, ...sources.map((x) => x.n));

  return (
    <section aria-label="Visitors sent" className="rounded-xl border border-hairline bg-void p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-faint">Visitors sent to your site</h3>
          <div className="flex items-baseline gap-4">
            <div>
              <span className="font-display text-2xl font-black text-ink tabular-nums">{fmt(stats.last7)}</span>
              <span className="ml-1 text-[11px] text-ink-dim">last 7 days</span>
            </div>
            <div>
              <span className="font-display text-lg font-bold text-ink tabular-nums">{fmt(stats.last30)}</span>
              <span className="ml-1 text-[11px] text-ink-dim">30 days</span>
            </div>
          </div>
        </div>
        <Sparkline daily={stats.daily} />
      </div>

      {sources.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Visitors by placement, last 30 days">
          {sources.map(({ s, n }) => (
            <li key={s} className="grid grid-cols-[7.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-[11px]">
              <span className="text-ink-dim truncate">{SOURCE_LABELS[s]}</span>
              <span className="h-1.5 rounded-full bg-surface overflow-hidden">
                <span className="block h-full rounded-full bg-signal" style={{ width: `${(n / top) * 100}%` }} />
              </span>
              <span className="text-right font-mono font-bold text-ink tabular-nums">{fmt(n)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-ink-faint">
          No clicks yet. Every click on your Visit Website button, Featured and Spotlight cards is counted here.
        </p>
      )}

      <p className="text-[10px] text-ink-faint leading-relaxed">
        Unique visitors per day (UTC), bots and Do-Not-Track excluded · {fmt(stats.clicks30)} total clicks in 30 days
        {stats.badgeVisitors30 > 0 && <> · {fmt(stats.badgeVisitors30)} came here via your badge</>}
      </p>
    </section>
  );
}
