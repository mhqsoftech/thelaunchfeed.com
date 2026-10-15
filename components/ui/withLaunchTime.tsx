import { Fragment, type ReactNode } from "react";
import { LaunchTime, IST_LABEL } from "@/components/ui/LaunchTime";

/**
 * Swap every "6:00 AM IST" inside a copy string for <LaunchTime /> so it
 * shows in the visitor's timezone. Server-safe (no "use client"), so it works
 * in server pages as well as client components.
 */
export function withLaunchTime(text: string, opts: { showIst?: boolean } = {}): ReactNode {
  const parts = text.split(IST_LABEL);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && <LaunchTime showIst={opts.showIst} />}
    </Fragment>
  ));
}
