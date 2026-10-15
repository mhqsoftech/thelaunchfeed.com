"use client";

import { useEffect, useState } from "react";
import { getNext6AmIstRelease } from "@/lib/schedule";

const DAY = 24 * 60 * 60 * 1000;

/** One digit tile; re-keys on change so the roll-in animation replays. */
function Digit({ value }: { value: string }) {
  return (
    <span className="tlf-digit relative inline-flex items-center justify-center overflow-hidden rounded-lg border border-hairline bg-surface font-display font-black text-ink tabular-nums">
      <span key={value} className="tlf-digit-roll">
        {value}
      </span>
    </span>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  const [a, b] = String(value).padStart(2, "0").split("");
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-1">
        <Digit value={a} />
        <Digit value={b} />
      </div>
      <span className="text-[10px] font-mono uppercase tracking-widest text-ink-faint">{label}</span>
    </div>
  );
}

/**
 * Launch clock for the next 6:00 AM IST batch, shown in the visitor's timezone.
 *  - Doto digit tiles that roll over each tick
 *  - a 24-square "cycle track" (one square per hour of the current cycle,
 *    lit in the brand's stepped-opacity orange, the current hour pulsing)
 *  - the release time in the visitor's own timezone (IST / UTC as reference)
 */
export function NextLaunchCountdown({ variant = "full", className = "" }: { variant?: "full" | "compact"; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) {
    return <div className={`${variant === "full" ? "h-[196px]" : "h-10"} rounded-[var(--radius-card)] bg-surface/60 ${className}`} aria-hidden />;
  }

  const next = getNext6AmIstRelease(new Date(now));
  const left = Math.max(0, next.getTime() - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const elapsedHours = Math.min(24, (DAY - left) / 3_600_000);

  // Headline in the visitor's own timezone; IST/UTC kept as the reference.
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isIst = localTz === "Asia/Kolkata" || localTz === "Asia/Calcutta";
  const localLabel = next.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  if (variant === "compact") {
    return (
      <div
        className={`inline-flex items-center gap-2.5 h-10 pl-3 pr-4 rounded-full border border-hairline bg-card text-sm ${className}`}
        role="timer"
        aria-label={`Next launch batch in ${h} hours ${m} minutes`}
      >
        <span className="tlf-live-dot w-1.5 h-1.5 rounded-full bg-signal-bright" aria-hidden />
        <span className="text-ink-dim">Next batch in</span>
        <span className="font-mono font-semibold text-ink tabular-nums">
          {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </span>
      </div>
    );
  }

  return (
    <section
      className={`relative overflow-hidden rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card p-5 sm:p-6 font-sans ${className}`}
      aria-labelledby="next-launch-heading"
    >
      <div className="tlf-signal-grid absolute inset-0 pointer-events-none" aria-hidden />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5 min-w-0">
          <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-signal">
            <span className="tlf-live-dot w-1.5 h-1.5 rounded-full bg-signal-bright" aria-hidden />
            Next launch batch
          </p>
          <h2 id="next-launch-heading" className="text-lg sm:text-xl font-semibold text-ink">
            {localLabel}
            {!isIst && <span className="ml-2 text-sm font-normal text-ink-faint">your time</span>}
          </h2>
          <p className="text-sm text-ink-dim">
            6:00 AM IST · 00:30 UTC. Submit before then to make this batch.
          </p>
        </div>
        <div className="flex items-start gap-2 sm:gap-3" role="timer" aria-live="off" aria-label={`${h} hours, ${m} minutes, ${s} seconds`}>
          <Unit value={h} label="hrs" />
          <span className="font-display font-black text-2xl text-ink-faint pt-2" aria-hidden>:</span>
          <Unit value={m} label="min" />
          <span className="font-display font-black text-2xl text-ink-faint pt-2" aria-hidden>:</span>
          <Unit value={s} label="sec" />
        </div>
      </div>

      {/* 24-hour cycle track */}
      <div className="relative mt-5">
        <div className="grid grid-cols-24 gap-[3px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }} aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => {
            const done = i < Math.floor(elapsedHours);
            const current = i === Math.floor(elapsedHours);
            // Brand stepping: the last hours before launch glow brightest.
            const opacity = done ? [0.35, 0.65, 0.85, 1][Math.min(3, Math.floor(i / 6))] : 1;
            return (
              <span
                key={i}
                className={`h-2.5 rounded-[2px] ${done ? "bg-signal" : current ? "bg-signal tlf-live-dot" : "bg-surface border border-hairline"}`}
                style={done ? { opacity } : undefined}
              />
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-mono uppercase tracking-wider text-ink-faint">
          <span>Last batch</span>
          <span>{Math.round((elapsedHours / 24) * 100)}% of today&apos;s cycle</span>
          <span>Lift-off</span>
        </div>
      </div>
    </section>
  );
}
