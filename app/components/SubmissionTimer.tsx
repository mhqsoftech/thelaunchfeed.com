"use client";

import React, { useEffect, useState } from "react";
/** dd HH:MM:SS or HH:MM:SS depending on whether > 1 day remains */
function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "PUBLISHING…";
  const s = Math.floor(msRemaining / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export default function SubmissionTimer({
  target,
  label = "PUBLISHES IN",
  compact = false,
}: {
  target?: string | Date | null;
  label?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const parsedDate = target ? new Date(target) : null;
  const isValidDate = parsedDate ? !isNaN(parsedDate.getTime()) : false;

  const remaining = isValidDate && parsedDate ? parsedDate.getTime() - now : 0;
  const text = isValidDate ? formatCountdown(remaining) : "LIVE NOW";
  const done = remaining <= 0;
  const targetFormatted = isValidDate && parsedDate
    ? parsedDate.toISOString().replace("T", " ").slice(0, 19) + " UTC"
    : "LIVE NOW";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase px-2 py-0.5 border ${
          done ? "border-signal text-signal" : "border-hairline text-ink"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${done ? "bg-signal" : "bg-ink"}`} />
        {text}
      </span>
    );
  }

  return (
    <div
      className={`border p-4 font-mono ${
        done ? "border-signal" : "border-hairline"
      }`}
    >
      <div className="flex items-center justify-between text-[10px] uppercase text-ink-dim mb-2">
        <span>{label}</span>
        <span>{targetFormatted}</span>
      </div>
      <div className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight">{text}</div>
    </div>
  );
}
