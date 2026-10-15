"use client";

import { useEffect, useState } from "react";
import { getNext6AmIstRelease } from "@/lib/schedule";

export const IST_LABEL = "6:00 AM IST";

export type LocalLaunchTime = {
  /** "8:30 PM" in the visitor's clock */
  time: string;
  /** "EDT", "GMT+2", … */
  zone: string;
  /** "8:30 PM EDT" */
  label: string;
  /** The visitor is on IST already, so the local label is just "6:00 AM IST". */
  isIst: boolean;
};

/**
 * The daily 6:00 AM IST (00:30 UTC) release expressed in the visitor's own
 * timezone. Returns null during SSR / first render so the server HTML (what
 * search and AI crawlers read) always says "6:00 AM IST".
 */
export function useLocalLaunchTime(): LocalLaunchTime | null {
  const [value, setValue] = useState<LocalLaunchTime | null>(null);
  useEffect(() => {
    try {
      const next = getNext6AmIstRelease(new Date());
      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isIst = tzName === "Asia/Kolkata" || tzName === "Asia/Calcutta";
      const time = next.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      const zone =
        new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
          .formatToParts(next)
          .find((p) => p.type === "timeZoneName")?.value || tzName;
      setValue({ time, zone, label: isIst ? IST_LABEL : `${time} ${zone}`, isIst });
    } catch {
      setValue(null);
    }
  }, []);
  return value;
}

/**
 * Renders the launch time in the visitor's timezone ("8:30 PM EDT").
 * `showIst` appends the canonical time for non-IST visitors: "8:30 PM EDT (6:00 AM IST)".
 */
export function LaunchTime({ showIst = false, className }: { showIst?: boolean; className?: string }) {
  const local = useLocalLaunchTime();
  const text = !local || local.isIst ? IST_LABEL : showIst ? `${local.label} (${IST_LABEL})` : local.label;
  return (
    <time
      className={className}
      dateTime="00:30Z"
      title={local && !local.isIst ? `${IST_LABEL} · 00:30 UTC — shown in your timezone` : "00:30 UTC"}
      suppressHydrationWarning
    >
      {text}
    </time>
  );
}

/**
 * A specific scheduled release (e.g. a queued submission) in the visitor's
 * timezone: "Thu, 16 Oct · 8:30 PM EDT". SSR keeps the UTC + IST form.
 */
export function LocalReleaseDate({ value, className }: { value: Date | string | null | undefined; className?: string }) {
  const [label, setLabel] = useState<string | null>(null);
  const d = value ? new Date(value) : null;
  const valid = d && !isNaN(d.getTime());
  const iso = valid ? d.toISOString() : "";
  useEffect(() => {
    if (!iso) return;
    const date = new Date(iso);
    const day = date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    setLabel(`${day} · ${time}`);
  }, [iso]);
  if (!valid) return <span className={className}>Live now</span>;
  const fallback = `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC (${IST_LABEL})`;
  return (
    <time className={className} dateTime={iso} title={fallback} suppressHydrationWarning>
      {label ?? fallback}
    </time>
  );
}
