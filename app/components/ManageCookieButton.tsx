"use client";

import React from "react";
import { openCookieSettings } from "@/app/lib/cookieConsent";

export default function ManageCookieButton({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={
        className ||
        "inline-flex items-center gap-1.5 px-3 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs font-mono font-bold text-ink hover:text-signal transition-colors cursor-pointer rounded-xs"
      }
    >
      <span className="w-1.5 h-1.5 rounded-full bg-signal" />
      <span>{children || "Manage Cookie & Telemetry Preferences"}</span>
    </button>
  );
}
