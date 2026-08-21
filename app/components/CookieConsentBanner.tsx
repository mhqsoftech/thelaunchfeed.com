"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { LaunchFeedLogo } from "@/components/ui/LaunchFeedLogo";
import {
  getStoredConsent,
  saveConsent,
  applyConsentToTrackers,
  TLF_OPEN_SETTINGS_EVENT,
  type CookieConsentSettings,
} from "@/app/lib/cookieConsent";

export default function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  useEffect(() => {
    setMounted(true);
    const stored = getStoredConsent();

    if (stored) {
      // User has already made a choice previously -> apply to trackers, do not prompt
      applyConsentToTrackers(stored);
      setAnalyticsChecked(stored.analytics);
      setIsOpen(false);
    } else {
      // First time visitor -> show banner
      setIsOpen(true);
    }

    // Listen for custom open events from footer or privacy page
    const handleOpenSettings = () => {
      const current = getStoredConsent();
      if (current) {
        setAnalyticsChecked(current.analytics);
      }
      setShowCustomize(true);
      setIsOpen(true);
    };

    window.addEventListener(TLF_OPEN_SETTINGS_EVENT, handleOpenSettings);
    return () => {
      window.removeEventListener(TLF_OPEN_SETTINGS_EVENT, handleOpenSettings);
    };
  }, []);

  if (!mounted || !isOpen) {
    return null;
  }

  const handleAcceptAll = () => {
    saveConsent(true);
    setIsOpen(false);
    setShowCustomize(false);
  };

  const handleRejectNonEssential = () => {
    saveConsent(false);
    setIsOpen(false);
    setShowCustomize(false);
  };

  const handleSaveCustom = () => {
    saveConsent(analyticsChecked);
    setIsOpen(false);
    setShowCustomize(false);
  };

  return (
    <aside
      aria-label="Cookie and telemetry consent preferences"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-md z-[9990] animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="bg-void/95 backdrop-blur-md border border-hairline shadow-2xl p-4 sm:p-5 rounded-xs space-y-3 font-mono text-ink text-xs">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2.5">
          <div className="flex items-center gap-2">
            <LaunchFeedLogo size={14} />
            <span className="font-bold text-[11px] uppercase tracking-wider text-ink">
              Telemetry &amp; Cookies
            </span>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 border border-hairline bg-surface/60 text-ink-dim uppercase">
            Protocol v1.0
          </span>
        </div>

        {/* Description Body */}
        <p className="text-[11px] text-ink-dim leading-relaxed font-sans">
          We use strictly necessary cookies for secure session authentication and optional telemetry (Google Analytics &amp; Clarity session heatmaps) to optimize leaderboard ranking metrics. No invasive advertising trackers.
        </p>

        {/* Expandable Customization Section */}
        {showCustomize && (
          <div className="space-y-2 pt-1 border-t border-hairline font-mono text-[11px]">
            {/* Essential Cookies */}
            <div className="flex items-start justify-between gap-3 p-2 bg-surface/40 border border-hairline rounded-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-ink">Strictly Necessary</span>
                  <span className="text-[9px] text-verified font-bold uppercase">[Required]</span>
                </div>
                <p className="text-[10px] text-ink-dim font-sans leading-tight">
                  Session authentication tokens, CSRF protection, and UI theme persistence.
                </p>
              </div>
              <input
                type="checkbox"
                checked={true}
                disabled
                className="mt-0.5 accent-signal cursor-not-allowed opacity-80"
                aria-label="Strictly Necessary Cookies (Required)"
              />
            </div>

            {/* Analytics & Telemetry */}
            <div className="flex items-start justify-between gap-3 p-2 bg-surface/40 border border-hairline rounded-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-ink">Analytics &amp; Heatmaps</span>
                  <span className="text-[9px] text-signal font-bold uppercase">[Optional]</span>
                </div>
                <p className="text-[10px] text-ink-dim font-sans leading-tight">
                  Aggregated pageview traffic (GA4) and anonymous mouse telemetry (Microsoft Clarity).
                </p>
              </div>
              <input
                type="checkbox"
                checked={analyticsChecked}
                onChange={(e) => setAnalyticsChecked(e.target.checked)}
                className="mt-0.5 accent-signal cursor-pointer w-3.5 h-3.5"
                aria-label="Toggle Analytics and Heatmaps"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          {showCustomize ? (
            <>
              <button
                type="button"
                onClick={handleSaveCustom}
                className="flex-1 px-3 py-1.5 bg-signal hover:opacity-90 text-void font-bold text-[11px] rounded-xs cursor-pointer transition-all text-center"
              >
                Save Preferences
              </button>
              <button
                type="button"
                onClick={() => setShowCustomize(false)}
                className="px-3 py-1.5 border border-hairline bg-surface hover:bg-raised text-ink-dim hover:text-ink text-[11px] rounded-xs cursor-pointer transition-all text-center"
              >
                Back
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="flex-1 px-3 py-1.5 bg-signal hover:opacity-90 text-void font-bold text-[11px] rounded-xs cursor-pointer transition-all text-center"
              >
                Accept All
              </button>
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="px-3 py-1.5 border border-hairline bg-surface hover:bg-raised text-ink-dim hover:text-ink text-[11px] rounded-xs cursor-pointer transition-all text-center"
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={() => setShowCustomize(true)}
                className="px-2 py-1.5 text-ink-faint hover:text-ink text-[10px] underline underline-offset-2 cursor-pointer transition-colors text-center"
              >
                Customize
              </button>
            </>
          )}
        </div>

        {/* Footer Link */}
        <div className="flex items-center justify-between text-[10px] text-ink-faint border-t border-hairline/60 pt-2">
          <span>Your choices are saved permanently.</span>
          <Link
            href="/privacy"
            className="text-signal hover:underline transition-colors"
          >
            Privacy Policy &rarr;
          </Link>
        </div>
      </div>
    </aside>
  );
}
