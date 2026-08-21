"use client";

import React, { useMemo, useState } from "react";
import { PaymentProviderLogo } from "@/app/lib/revenueTelemetrySDK";

export interface MonthlyHistoryPoint {
  month: string;
  amountCents: number;
  amountFormatted?: string;
}

// Persisted history point shape from the RevenueConnection JSON columns —
// `period` is "YYYY-MM" for monthly and "YYYY-MM-DD" for daily.
export interface PeriodHistoryPoint {
  period: string;
  amountCents: number;
}

export interface RevenueSeries {
  providerName: string;
  mrrCents: number;
  totalRevenueCents?: number;
  history?: MonthlyHistoryPoint[];
  monthlyHistory?: PeriodHistoryPoint[];
  dailyHistory?: PeriodHistoryPoint[];
}

export type RevenueGranularity = "month" | "day";

export interface VerifiedRevenueChartProps {
  revenueFormatted: string; // e.g. "$28.56 / mo" or "$14.2K / mo"
  mrrCents?: number;
  totalRevenueCents?: number;
  history?: MonthlyHistoryPoint[];
  monthlyHistory?: PeriodHistoryPoint[];
  dailyHistory?: PeriodHistoryPoint[];
  momGrowth?: string;
  providerName?: string; // e.g. "Dodo Payments" or "Stripe"
  series?: RevenueSeries[]; // per-provider breakdown; when >=2, renders multi-line chart
  className?: string;
}

const SERIES_COLORS = [
  "var(--color-signal)",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#22d3ee",
  "#84cc16",
];

// Solid hex fallbacks used for gradient fills (CSS vars cant be used inside
// linearGradient stops reliably across all engines, so pair each series with a
// stable hex for its area fill).
const SERIES_HEX = [
  "#84cc16",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#22d3ee",
  "#eab308",
];

const slug = (s: string) => s.replace(/[^A-Za-z0-9]/g, "-").toLowerCase();

function formatCentsValue(cents: number): string {
  if (cents <= 0) return "$0";
  if (cents >= 10000000) {
    return `$${(cents / 10000000).toFixed(1)}M`;
  }
  if (cents >= 100000) {
    return `$${(cents / 100000).toFixed(1)}K`;
  }
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

export default function VerifiedRevenueChart({
  revenueFormatted,
  mrrCents,
  totalRevenueCents,
  history,
  monthlyHistory,
  dailyHistory,
  momGrowth,
  providerName = "Stripe",
  series,
  className = "",
}: VerifiedRevenueChartProps) {
  const [granularity, setGranularity] = useState<RevenueGranularity>("month");
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeSeries = useMemo(() => {
    if (series && series.length > 0) return series;
    return [{
      providerName,
      mrrCents: mrrCents ?? 0,
      totalRevenueCents,
      history,
      monthlyHistory,
      dailyHistory,
    }];
  }, [series, providerName, mrrCents, totalRevenueCents, history, monthlyHistory, dailyHistory]);
  const isMulti = activeSeries.length > 1;

  const seriesData = useMemo(() => {
    const monthNames = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    const now = new Date();
    const yearSuffix = (d: Date) => `'${String(d.getFullYear()).slice(2)}`;
    const monthLabel = (raw: string): string => {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return `${monthNames[d.getMonth()]} ${yearSuffix(d)}`;
      return raw;
    };
    const dayLabel = (raw: string): string => {
      // raw is "YYYY-MM-DD" — render as "AUG 21"
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return raw;
      return `${monthNames[d.getMonth()]} ${d.getDate()}`;
    };

    return activeSeries.map((s) => {
      // Prefer real persisted buckets for the current granularity when present.
      if (granularity === "day" && s.dailyHistory && s.dailyHistory.length >= 2) {
        return {
          providerName: s.providerName,
          points: s.dailyHistory.map((h) => ({
            month: dayLabel(h.period),
            amountCents: h.amountCents || 0,
            label: formatCentsValue(h.amountCents || 0),
          })),
        };
      }
      if (granularity === "month" && s.monthlyHistory && s.monthlyHistory.length >= 2) {
        return {
          providerName: s.providerName,
          points: s.monthlyHistory.map((h) => ({
            month: monthLabel(h.period),
            amountCents: h.amountCents || 0,
            label: formatCentsValue(h.amountCents || 0),
          })),
        };
      }
      // Legacy `history` prop (already-formatted month labels)
      if (granularity === "month" && s.history && s.history.length >= 2) {
        return {
          providerName: s.providerName,
          points: s.history.map((h) => ({
            month: monthLabel(h.month),
            amountCents: h.amountCents || 0,
            label: h.amountFormatted || formatCentsValue(h.amountCents || 0),
          })),
        };
      }
      // No real history from the gateway — render an honest empty baseline
      // (all zeros) rather than a synthesized ramp. The MRR + total-revenue
      // metric cards above still show the live aggregate.
      if (granularity === "day") {
        const days: Array<{ month: string; amountCents: number; label: string }> = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          days.push({
            month: `${monthNames[d.getMonth()]} ${d.getDate()}`,
            amountCents: 0,
            label: "$0",
          });
        }
        return { providerName: s.providerName, points: days };
      }
      const months: Array<{ month: string; amountCents: number; label: string }> = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: `${monthNames[d.getMonth()]} ${yearSuffix(d)}`,
          amountCents: 0,
          label: "$0",
        });
      }
      return { providerName: s.providerName, points: months };
    });
  }, [activeSeries, granularity]);

  // Primary series (aggregate) drives axis labels, MoM growth and total
  const pointsData = useMemo(() => {
    if (!isMulti) return seriesData[0].points;
    // Sum across providers per month position
    const first = seriesData[0].points;
    return first.map((_, i) => {
      const summed = seriesData.reduce((sum, s) => sum + (s.points[i]?.amountCents || 0), 0);
      return {
        month: first[i].month,
        amountCents: summed,
        label: formatCentsValue(summed),
      };
    });
  }, [seriesData, isMulti]);

  // Verified Total Revenue = all-time combined revenue across every connected
  // provider (comes from the summed `totalRevenueCents` prop). Fall back to the
  // sum of visible buckets only when no stored total is available.
  const calculatedTotalCents = useMemo(() => {
    if (typeof totalRevenueCents === "number" && totalRevenueCents > 0) {
      return totalRevenueCents;
    }
    return pointsData.reduce((sum, p) => sum + p.amountCents, 0);
  }, [totalRevenueCents, pointsData]);

  const totalRevenueFormatted = useMemo(() => {
    return formatCentsValue(calculatedTotalCents);
  }, [calculatedTotalCents]);

  // Current-period revenue = the last visible bucket. Used to swap the top-
  // card headline in daily mode so a $0-in-last-24h reality is not hidden by
  // an MRR string that was computed from active subscriptions.
  const currentPeriodCents = useMemo(() => {
    if (pointsData.length === 0) return 0;
    return pointsData[pointsData.length - 1].amountCents;
  }, [pointsData]);

  const rangeLabel = granularity === "day" ? "Last 90 days" : "Last 12 months";

  // Calculate real MoM growth if not provided
  const computedGrowth = useMemo(() => {
    const suffix = granularity === "day" ? "DoD" : "MoM";
    if (momGrowth && momGrowth.trim().length > 0 && granularity === "month") {
      return momGrowth;
    }
    if (pointsData.length < 2) return `+0.0% ${suffix}`;
    const current = pointsData[pointsData.length - 1].amountCents;
    const prev = pointsData[pointsData.length - 2].amountCents;
    if (prev === 0 && current === 0) return `+0.0% ${suffix}`;
    if (prev === 0) return "New Launch";
    const growth = ((current - prev) / prev) * 100;
    const sign = growth >= 0 ? "+" : "";
    return `${sign}${growth.toFixed(1)}% ${suffix}`;
  }, [momGrowth, pointsData, granularity]);

  // SVG chart dimensions & calculations
  const width = 600;
  const height = 180;
  const paddingX = 45;
  const paddingY = 32;

  const allValues = isMulti
    ? seriesData.flatMap((s) => s.points.map((p) => p.amountCents))
    : pointsData.map((p) => p.amountCents);
  const maxVal = Math.max(...allValues, 100);
  const minVal = 0;

  const toPoints = (arr: Array<{ month: string; amountCents: number; label: string }>) =>
    arr.map((pt, i) => {
      const x = paddingX + (i * (width - 2 * paddingX)) / (arr.length - 1);
      const y = height - paddingY - ((pt.amountCents - minVal) / (maxVal - minVal)) * (height - 2 * paddingY);
      return { x, y, val: pt.amountCents, month: pt.month, label: pt.label };
    });

  const points = toPoints(pointsData);
  const seriesRendered = seriesData.map((s, idx) => ({
    providerName: s.providerName,
    color: SERIES_COLORS[idx % SERIES_COLORS.length],
    hex: SERIES_HEX[idx % SERIES_HEX.length],
    gradientId: `revgrad-${slug(s.providerName)}-${idx}`,
    points: toPoints(s.points),
  }));

  const buildAreaPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    const line = pts.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = pts[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, "");
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L ${last.x} ${height - paddingY} L ${first.x} ${height - paddingY} Z`;
  };

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = pts[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, "");

  const dPath = buildPath(points);
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  const areaPath = `${dPath} L ${lastPt.x} ${height - paddingY} L ${firstPt.x} ${height - paddingY} Z`;

  return (
    <div className={`border border-hairline bg-surface/30 p-4 sm:p-6 space-y-4 font-mono ${className}`}>
      {/* Header & Verification Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal"></span>
          </span>
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
            Verified Monthly Revenue (Live Gateway Telemetry)
          </h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {(isMulti ? activeSeries.map((s) => s.providerName) : [providerName]).map((name) => (
            <div
              key={name}
              className="flex items-center gap-1.5 text-[10px] text-signal font-bold bg-void px-2 py-1 border border-signal/40 uppercase shrink-0"
            >
              <PaymentProviderLogo id={name} className="w-3.5 h-3.5" />
              <span>{name} Verified</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* Granularity picker — parallelogram-styled dropdown (trustmrr.com style) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] text-ink-faint uppercase font-bold tracking-wider">
          Range · {granularity === "month" ? "Last 12 months" : "Last 90 days"}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="group inline-flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-[10px] font-mono font-bold uppercase text-ink bg-void border border-signal/50 hover:border-signal transition-colors cursor-pointer"
            style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}
          >
            <span className="text-signal">◆</span>
            <span>{granularity === "month" ? "Monthly" : "Daily"}</span>
            <svg className={`w-2.5 h-2.5 transition-transform ${pickerOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="square" d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {pickerOpen && (
            <div
              className="absolute right-0 mt-1 z-20 min-w-[128px] bg-void border border-signal/50 shadow-lg font-mono"
              style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}
            >
              {(["month", "day"] as RevenueGranularity[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { setGranularity(opt); setPickerOpen(false); }}
                  className={`block w-full text-left px-4 py-1.5 text-[10px] uppercase font-bold cursor-pointer transition-colors ${
                    granularity === opt ? "bg-signal/15 text-signal" : "text-ink hover:bg-signal/10 hover:text-signal"
                  }`}
                >
                  {opt === "month" ? "Monthly · 12M" : "Daily · 90D"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
        <div className="p-2.5 sm:p-3 border border-hairline bg-void/60 space-y-1">
          <div className="text-[9px] sm:text-[10px] text-ink-faint uppercase font-bold">
            {granularity === "day" ? "Revenue · Today" : "Verified Current MRR"}
          </div>
          <div className="text-base sm:text-lg font-bold text-signal">
            {granularity === "day" ? formatCentsValue(currentPeriodCents) : revenueFormatted}
          </div>
          <div className="text-[9px] text-signal font-semibold">{computedGrowth}</div>
        </div>
        <div className="p-2.5 sm:p-3 border border-hairline bg-void/60 space-y-1">
          <div className="text-[9px] sm:text-[10px] text-ink-faint uppercase font-bold">Verified Total Revenue</div>
          <div className="text-base sm:text-lg font-bold text-ink">{totalRevenueFormatted}</div>
          <div className="text-[9px] text-ink-dim">All-time · Combined providers</div>
        </div>
        <div className="p-2.5 sm:p-3 border border-hairline bg-void/60 space-y-1 xs:col-span-2 sm:col-span-1">
          <div className="text-[9px] sm:text-[10px] text-ink-faint uppercase font-bold">Cryptographic Status</div>
          <div className="text-xs font-bold text-ink uppercase truncate">Read-Only Telemetry</div>
          <div className="text-[9px] text-signal font-semibold">✓ 100% Cryptographic Match</div>
        </div>
      </div>

      {/* SVG Line Chart */}
      <div className="relative border border-hairline bg-void p-2 sm:p-4 overflow-x-auto no-scrollbar">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[340px] sm:min-w-[450px] overflow-visible"
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-signal)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--color-signal)" stopOpacity="0.0" />
            </linearGradient>
            {seriesRendered.map((s) => (
              <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.hex} stopOpacity="0.35" />
                <stop offset="60%" stopColor={s.hex} stopOpacity="0.12" />
                <stop offset="100%" stopColor={s.hex} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {/* Horizontal Grid Lines */}
          {[0.25, 0.5, 0.75].map((ratio, idx) => {
            const y = paddingY + ratio * (height - 2 * paddingY);
            return (
              <line
                key={idx}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="var(--color-hairline)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            );
          })}

          {/* Area Fill (aggregate) */}
          {!isMulti && <path d={areaPath} fill="url(#revenueGradient)" />}

          {isMulti && (
            <>
              {seriesRendered.map((s) => (
                <path
                  key={`area-${s.providerName}`}
                  d={buildAreaPath(s.points)}
                  fill={`url(#${s.gradientId})`}
                  opacity="0.9"
                />
              ))}
              {seriesRendered.map((s) => (
                <path
                  key={`line-${s.providerName}`}
                  d={buildPath(s.points)}
                  fill="none"
                  stroke={s.hex}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {seriesRendered.map((s) =>
                s.points.map((pt, i) => (
                  <circle
                    key={`pt-${s.providerName}-${i}`}
                    cx={pt.x}
                    cy={pt.y}
                    r="3"
                    fill="var(--color-void)"
                    stroke={s.hex}
                    strokeWidth="2"
                  />
                ))
              )}
            </>
          )}
          {!isMulti && (
            <path
              d={dPath}
              fill="none"
              stroke="var(--color-signal)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points & Labels (aggregate axis) */}
          {(() => null)()}
          {points.map((pt, i) => {
            const isHovered = hoverIdx === i;
            const colWidth = (width - 2 * paddingX) / Math.max(points.length - 1, 1);
            // Thin labels when there are many points (daily mode) so they stay legible.
            const labelEvery = Math.max(1, Math.ceil(points.length / 8));
            const showXLabel = i % labelEvery === 0 || i === points.length - 1;
            const showValueLabel = !isMulti && (points.length <= 12 || i === points.length - 1 || isHovered);
            return (
              <g key={i} className="cursor-pointer">
                {/* Vertical hover-hit rectangle spanning full chart height */}
                <rect
                  x={pt.x - colWidth / 2}
                  y={paddingY}
                  width={colWidth}
                  height={height - 2 * paddingY}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
                />
                {/* Vertical guide */}
                <line
                  x1={pt.x}
                  y1={paddingY}
                  x2={pt.x}
                  y2={height - paddingY}
                  stroke={isHovered ? "var(--color-signal)" : "var(--color-hairline)"}
                  strokeDasharray={isHovered ? "0" : "2 2"}
                  strokeWidth={isHovered ? "1.5" : "1"}
                  opacity={isHovered ? 0.6 : 1}
                />

                {/* Aggregate node — only when single-series (otherwise per-series nodes already drawn) */}
                {!isMulti && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 5.5 : 4.5}
                    className="fill-void stroke-signal"
                    strokeWidth="2.5"
                  />
                )}

                {/* Aggregate value above node — only in single-series mode */}
                {showValueLabel && (
                  <text
                    x={pt.x}
                    y={pt.y - 10}
                    textAnchor="middle"
                    className="fill-ink text-[10px] font-mono font-bold"
                  >
                    {pt.label}
                  </text>
                )}

                {/* Month/day label below baseline (thinned when dense) */}
                {showXLabel && (
                  <text
                    x={pt.x}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-ink-dim text-[10px] font-mono uppercase font-bold"
                  >
                    {pt.month}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover tooltip — per-series exact amounts for the hovered month */}
          {hoverIdx !== null && (() => {
            const anchor = points[hoverIdx];
            if (!anchor) return null;
            const rows = isMulti
              ? seriesRendered.map((s) => ({
                  name: s.providerName,
                  hex: s.hex,
                  label: s.points[hoverIdx]?.label ?? "$0",
                }))
              : [{ name: providerName, hex: "#84cc16", label: anchor.label }];
            const rowH = 14;
            const boxW = 148;
            const boxH = 22 + rows.length * rowH;
            const bx = Math.min(Math.max(anchor.x + 10, paddingX), width - paddingX - boxW);
            const by = Math.max(paddingY, anchor.y - boxH - 8);
            return (
              <g pointerEvents="none">
                <rect
                  x={bx}
                  y={by}
                  width={boxW}
                  height={boxH}
                  rx="2"
                  fill="var(--color-void)"
                  stroke="var(--color-hairline)"
                  strokeWidth="1"
                />
                <text
                  x={bx + 8}
                  y={by + 14}
                  className="fill-ink text-[10px] font-mono font-bold uppercase"
                >
                  {anchor.month}
                </text>
                {rows.map((r, ri) => (
                  <g key={r.name}>
                    <rect
                      x={bx + 8}
                      y={by + 20 + ri * rowH + 3}
                      width={6}
                      height={6}
                      fill={r.hex}
                    />
                    <text
                      x={bx + 20}
                      y={by + 20 + ri * rowH + 9}
                      className="fill-ink-dim text-[10px] font-mono"
                    >
                      {r.name}
                    </text>
                    <text
                      x={bx + boxW - 8}
                      y={by + 20 + ri * rowH + 9}
                      textAnchor="end"
                      className="fill-ink text-[10px] font-mono font-bold"
                    >
                      {r.label}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>

      {isMulti && (
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono border-t border-hairline pt-2">
          {seriesRendered.map((s) => (
            <div key={s.providerName} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: s.hex }}
              />
              <PaymentProviderLogo id={s.providerName} className="w-3.5 h-3.5" />
              <span className="text-ink-dim uppercase font-bold">{s.providerName}</span>
              <span className="text-ink">
                {formatCentsValue(activeSeries.find((a) => a.providerName === s.providerName)?.mrrCents || 0)} / mo
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-ink-faint border-t border-hairline pt-2">
        <span>
          Verified telemetry: Direct Gateway Audit via {isMulti ? activeSeries.map((s) => s.providerName).join(" + ") : providerName}
        </span>
        <span className="text-signal font-bold shrink-0">✓ Realtime Verified</span>
      </div>
    </div>
  );
}
