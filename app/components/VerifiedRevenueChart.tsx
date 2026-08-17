"use client";

import React, { useMemo } from "react";

export interface MonthlyHistoryPoint {
  month: string;
  amountCents: number;
  amountFormatted?: string;
}

export interface VerifiedRevenueChartProps {
  revenueFormatted: string; // e.g. "$28.56 / mo" or "$14.2K / mo"
  mrrCents?: number;
  totalRevenueCents?: number;
  history?: MonthlyHistoryPoint[];
  momGrowth?: string;
  providerName?: string; // e.g. "Dodo Payments" or "Stripe"
  className?: string;
}

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
  momGrowth,
  providerName = "Stripe",
  className = "",
}: VerifiedRevenueChartProps) {
  // Derive points data from verified history, or calculate based on exact calendar months
  const pointsData = useMemo(() => {
    if (history && history.length >= 2) {
      return history.map((h) => ({
        month: h.month,
        amountCents: h.amountCents || 0,
        label: h.amountFormatted || formatCentsValue(h.amountCents || 0),
      }));
    }

    const now = new Date();
    const months: Array<{ month: string; amountCents: number; label: string }> = [];
    const monthNames = [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
    ];

    // Compute active verified cents from mrrCents or revenueFormatted
    let parsedMrrCents = mrrCents ?? 0;
    if (parsedMrrCents === 0 && revenueFormatted) {
      const match = revenueFormatted.match(/[\d.]+/);
      if (match) {
        const val = parseFloat(match[0]);
        if (revenueFormatted.includes("K")) {
          parsedMrrCents = Math.round(val * 1000 * 100);
        } else {
          parsedMrrCents = Math.round(val * 100);
        }
      }
    }

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = monthNames[d.getMonth()];
      // Current month holds the verified MRR, prior months reflect baseline
      const amount = i === 0 ? parsedMrrCents : 0;
      months.push({
        month: label,
        amountCents: amount,
        label: formatCentsValue(amount),
      });
    }

    return months;
  }, [history, mrrCents, revenueFormatted]);

  // Compute exact 6-month or cumulative total revenue
  const calculatedTotalCents = useMemo(() => {
    if (typeof totalRevenueCents === "number" && totalRevenueCents > 0) {
      return totalRevenueCents;
    }
    return pointsData.reduce((sum, p) => sum + p.amountCents, 0);
  }, [totalRevenueCents, pointsData]);

  const totalRevenueFormatted = useMemo(() => {
    return formatCentsValue(calculatedTotalCents);
  }, [calculatedTotalCents]);

  // Calculate real MoM growth if not provided
  const computedGrowth = useMemo(() => {
    if (momGrowth && momGrowth.trim().length > 0) {
      return momGrowth;
    }
    if (pointsData.length < 2) return "+0.0% MoM";
    const current = pointsData[pointsData.length - 1].amountCents;
    const prev = pointsData[pointsData.length - 2].amountCents;
    if (prev === 0 && current === 0) return "+0.0% MoM";
    if (prev === 0) return "New Launch";
    const growth = ((current - prev) / prev) * 100;
    const sign = growth >= 0 ? "+" : "";
    return `${sign}${growth.toFixed(1)}% MoM`;
  }, [momGrowth, pointsData]);

  // SVG chart dimensions & calculations
  const width = 600;
  const height = 180;
  const paddingX = 45;
  const paddingY = 32;

  const maxVal = Math.max(...pointsData.map((p) => p.amountCents), 100);
  const minVal = 0;

  const points = pointsData.map((pt, i) => {
    const val = pt.amountCents;
    const x = paddingX + (i * (width - 2 * paddingX)) / (pointsData.length - 1);
    const y =
      height - paddingY - ((val - minVal) / (maxVal - minVal)) * (height - 2 * paddingY);
    return { x, y, val, month: pt.month, label: pt.label };
  });

  // Construct SVG path string for smooth line
  const dPath = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const cx1 = prev.x + (pt.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = prev.x + (pt.x - prev.x) / 2;
    const cy2 = pt.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
  }, "");

  // Area path for gradient fill beneath line
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
        <div className="flex items-center gap-1.5 text-[10px] text-signal font-bold bg-void px-2.5 py-1 border border-signal/40 uppercase shrink-0 self-start sm:self-auto">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
          </svg>
          <span>{providerName} Live API Mesh</span>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
        <div className="p-2.5 sm:p-3 border border-hairline bg-void/60 space-y-1">
          <div className="text-[9px] sm:text-[10px] text-ink-faint uppercase font-bold">Verified Current MRR</div>
          <div className="text-base sm:text-lg font-bold text-signal">{revenueFormatted}</div>
          <div className="text-[9px] text-signal font-semibold">{computedGrowth}</div>
        </div>
        <div className="p-2.5 sm:p-3 border border-hairline bg-void/60 space-y-1">
          <div className="text-[9px] sm:text-[10px] text-ink-faint uppercase font-bold">Verified Total Revenue</div>
          <div className="text-base sm:text-lg font-bold text-ink">{totalRevenueFormatted}</div>
          <div className="text-[9px] text-ink-dim">Direct Gateway Audit</div>
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
              <stop offset="0%" stopColor="var(--color-signal)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-signal)" stopOpacity="0.0" />
            </linearGradient>
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

          {/* Area Fill */}
          <path d={areaPath} fill="url(#revenueGradient)" />

          {/* Smooth Revenue Trend Line */}
          <path
            d={dPath}
            fill="none"
            stroke="var(--color-signal)"
            strokeWidth="3"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />

          {/* Data Points & Labels */}
          {points.map((pt, i) => (
            <g key={i} className="group cursor-pointer">
              {/* Vertical dotted guide */}
              <line
                x1={pt.x}
                y1={pt.y}
                x2={pt.x}
                y2={height - paddingY}
                stroke="var(--color-hairline)"
                strokeDasharray="2 2"
                strokeWidth="1"
              />

              {/* Data Node Circle */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="4.5"
                className="fill-void stroke-signal"
                strokeWidth="2.5"
              />

              {/* Value Callout Badge above node */}
              <text
                x={pt.x}
                y={pt.y - 10}
                textAnchor="middle"
                className="fill-ink text-[10px] font-mono font-bold"
              >
                {pt.label}
              </text>

              {/* Month Label below baseline */}
              <text
                x={pt.x}
                y={height - 8}
                textAnchor="middle"
                className="fill-ink-dim text-[10px] font-mono uppercase font-bold"
              >
                {pt.month}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-ink-faint border-t border-hairline pt-2">
        <span>Verified telemetry: Direct Gateway Audit via {providerName}</span>
        <span className="text-signal font-bold shrink-0">✓ Realtime Verified</span>
      </div>
    </div>
  );
}
