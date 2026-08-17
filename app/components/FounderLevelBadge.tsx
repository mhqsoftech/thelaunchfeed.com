"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

/* ──────────────────────────────────────────────────────────────────────────────
   MINIMALIST GEOMETRIC VECTOR EMBLEMS (Theme Synchronized & High Precision)
────────────────────────────────────────────────────────────────────────────── */

export function GenesisRocketIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 2V6M12 18V22M2 12H6M18 12H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export function VelocityBoltIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 13L12 3V9.5H20L12 21V14.5H4L12 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path d="M7 12H17" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}

export function ApexPrismIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 3L21 19H3L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M12 3V19M12 11L3 19M12 11L21 19" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="miter" />
      <circle cx="12" cy="11" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function TitanCrownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L21 7.5V16.5L12 22L3 16.5V7.5L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M12 2V22M21 7.5L12 13L3 7.5M21 16.5L12 13L3 16.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="miter" />
      <circle cx="12" cy="13" r="2" fill="currentColor" />
    </svg>
  );
}

export function LuminaryStarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
        fill="currentColor"
        fillOpacity="0.25"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <path d="M5 5L19 19M5 19L19 5" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 2" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   FOUNDER LEVEL CONFIGURATION (Minimal, Monochrome & Signal Neon Accents)
────────────────────────────────────────────────────────────────────────────── */

export type FounderLevelInfo = {
  level: number;
  title: string;
  shortCode: string;
  badgeLabel: string;
  tagline: string;
  perk: string;
  color: string;
  bgStyle: string;
  borderStyle: string;
  textStyle: string;
  minPoints: number;
  nextLevelPoints: number | null;
  IconComponent: React.ComponentType<{ className?: string }>;
};

export const FOUNDER_LEVELS: FounderLevelInfo[] = [
  {
    level: 1,
    title: "Genesis Founder",
    shortCode: "GENESIS",
    badgeLabel: "LEVEL 01 · GENESIS",
    tagline: "Initiating software launch sequence into the ecosystem",
    perk: "Live profile telemetry & ecosystem indexing",
    color: "var(--ink-dim)",
    bgStyle: "bg-surface/40",
    borderStyle: "border-hairline",
    textStyle: "text-ink-dim",
    minPoints: 0,
    nextLevelPoints: 25,
    IconComponent: GenesisRocketIcon,
  },
  {
    level: 2,
    title: "Velocity Builder",
    shortCode: "VELOCITY",
    badgeLabel: "LEVEL 02 · VELOCITY",
    tagline: "Building momentum with rapid shipping speed & execution",
    perk: "Verified Builder badge & Priority directory ranking",
    color: "var(--ink)",
    bgStyle: "bg-surface/70",
    borderStyle: "border-ink/20",
    textStyle: "text-ink",
    minPoints: 25,
    nextLevelPoints: 75,
    IconComponent: VelocityBoltIcon,
  },
  {
    level: 3,
    title: "Apex Innovator",
    shortCode: "APEX",
    badgeLabel: "LEVEL 03 · APEX",
    tagline: "Demonstrating high craft & strong community product traction",
    perk: "Apex badge glow & Featured launch discovery eligibility",
    color: "var(--signal)",
    bgStyle: "bg-signal/5",
    borderStyle: "border-signal/40",
    textStyle: "text-signal",
    minPoints: 75,
    nextLevelPoints: 200,
    IconComponent: ApexPrismIcon,
  },
  {
    level: 4,
    title: "Titan Architect",
    shortCode: "TITAN",
    badgeLabel: "LEVEL 04 · TITAN",
    tagline: "Mastering scalable engineering & deep developer trust",
    perk: "Titan Architect flair & Dedicated founder showcase slots",
    color: "var(--signal)",
    bgStyle: "bg-signal/10",
    borderStyle: "border-signal/60",
    textStyle: "text-signal",
    minPoints: 200,
    nextLevelPoints: 500,
    IconComponent: TitanCrownIcon,
  },
  {
    level: 5,
    title: "Luminary Syndicate",
    shortCode: "LUMINARY",
    badgeLabel: "LEVEL 05 · LUMINARY",
    tagline: "Ecosystem legend & visionary software craftsman",
    perk: "Ecosystem Luminary Hall-of-Fame & VIP launch broadcast rights",
    color: "var(--signal)",
    bgStyle: "bg-signal/15",
    borderStyle: "border-signal",
    textStyle: "text-signal",
    minPoints: 500,
    nextLevelPoints: null,
    IconComponent: LuminaryStarIcon,
  },
];

export function getFounderScore(
  productsCount: number,
  totalVotes: number,
  joinedAtStr?: string
): {
  points: number;
  currentLevel: FounderLevelInfo;
  nextLevel: FounderLevelInfo | null;
  progressPercent: number;
  ageDays: number;
} {
  let ageDays = 15;
  if (joinedAtStr) {
    const joinedTime = new Date(joinedAtStr).getTime();
    if (!isNaN(joinedTime)) {
      ageDays = Math.max(1, Math.floor((Date.now() - joinedTime) / (1000 * 60 * 60 * 24)));
    }
  }

  // Scoring matrix: 20 pts per product launched + 2 pts per vote + up to 90 age bonus points
  const points = productsCount * 20 + totalVotes * 2 + Math.min(ageDays, 90);

  let currentLevel = FOUNDER_LEVELS[0];
  let nextLevel: FounderLevelInfo | null = FOUNDER_LEVELS[1];

  for (let i = FOUNDER_LEVELS.length - 1; i >= 0; i--) {
    if (points >= FOUNDER_LEVELS[i].minPoints) {
      currentLevel = FOUNDER_LEVELS[i];
      nextLevel = FOUNDER_LEVELS[i + 1] || null;
      break;
    }
  }

  let progressPercent = 100;
  if (nextLevel) {
    const range = nextLevel.minPoints - currentLevel.minPoints;
    const gained = points - currentLevel.minPoints;
    progressPercent = Math.min(100, Math.max(0, Math.round((gained / range) * 100)));
  }

  return { points, currentLevel, nextLevel, progressPercent, ageDays };
}

/* ──────────────────────────────────────────────────────────────────────────────
   FOUNDER LEVEL BADGE PILL (Reusable Compact Badge)
────────────────────────────────────────────────────────────────────────────── */

export function FounderLevelBadge({
  level,
  className = "",
  showIcon = true,
}: {
  level: number | FounderLevelInfo;
  className?: string;
  showIcon?: boolean;
}) {
  const lvlInfo =
    typeof level === "number"
      ? FOUNDER_LEVELS.find((l) => l.level === level) || FOUNDER_LEVELS[0]
      : level;

  const Icon = lvlInfo.IconComponent;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 border font-mono text-[10px] font-bold uppercase tracking-wider ${lvlInfo.borderStyle} ${lvlInfo.bgStyle} ${lvlInfo.textStyle} ${className}`}
    >
      {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      <span>Lvl 0{lvlInfo.level} · {lvlInfo.shortCode}</span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   FOUNDER LEVEL BREAKDOWN MODAL (High-Tech Telemetry Spec Sheet)
────────────────────────────────────────────────────────────────────────────── */

export function FounderLevelBreakdownModal({
  scoreInfo,
  onClose,
  isSelf = false,
  founderName,
}: {
  scoreInfo: ReturnType<typeof getFounderScore>;
  onClose: () => void;
  isSelf?: boolean;
  founderName?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  const modalNode = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md cursor-pointer p-3 sm:p-4 overflow-y-auto flex items-start justify-center pt-6 sm:pt-14 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-void border border-hairline p-4 sm:p-6 space-y-4 font-mono shadow-2xl animate-in zoom-in-95 duration-200 cursor-default"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 bg-signal animate-pulse rounded-full shrink-0" />
            <span className="text-xs font-bold text-ink uppercase tracking-wider truncate">
              {founderName && !isSelf ? `${founderName} · Founder Telemetry` : "Founder Reputation & Progression Matrix"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 border border-hairline bg-surface hover:border-ink text-ink font-mono text-[10px] font-bold transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close"
          >
            [ESC / ✕]
          </button>
        </div>

        {/* Hero Active Tier Card */}
        <div className={`p-4 border ${scoreInfo.currentLevel.borderStyle} ${scoreInfo.currentLevel.bgStyle} space-y-3.5 relative overflow-hidden`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className={`w-11 h-11 border ${scoreInfo.currentLevel.borderStyle} bg-void/90 flex items-center justify-center ${scoreInfo.currentLevel.textStyle} shrink-0`}>
                <scoreInfo.currentLevel.IconComponent className="w-6 h-6" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-[10px] text-ink-faint uppercase font-bold tracking-widest">
                  Active Founder Tier
                </div>
                <h3 className={`text-base sm:text-lg font-bold ${scoreInfo.currentLevel.textStyle} truncate`}>
                  {scoreInfo.currentLevel.title}
                </h3>
                <p className="text-[11px] text-ink-dim font-sans leading-relaxed line-clamp-1">
                  {scoreInfo.currentLevel.tagline}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-base sm:text-lg font-bold text-ink whitespace-nowrap">
                {scoreInfo.points} <span className="text-xs text-ink-dim font-normal">PTS</span>
              </div>
              <span className="inline-block text-[9px] px-1.5 py-0.5 border border-signal bg-void text-signal font-bold uppercase tracking-wider mt-0.5">
                {scoreInfo.currentLevel.badgeLabel}
              </span>
            </div>
          </div>

          {/* Progression Gauge */}
          {scoreInfo.nextLevel ? (
            <div className="space-y-1.5 pt-1 border-t border-hairline/60">
              <div className="flex items-center justify-between text-[10px] text-ink-faint flex-wrap gap-1">
                <span>Next Tier: <strong className="text-ink">{scoreInfo.nextLevel.title}</strong></span>
                <span>
                  <strong className="text-signal">{scoreInfo.progressPercent}%</strong> ({scoreInfo.points} / {scoreInfo.nextLevel.minPoints} PTS)
                </span>
              </div>
              <div className="w-full h-2 bg-void border border-hairline overflow-hidden p-0.5">
                <div
                  className="h-full bg-signal transition-all duration-500 rounded-2xs"
                  style={{ width: `${scoreInfo.progressPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-signal font-bold pt-1 border-t border-signal/20 flex items-center gap-1.5">
              <span>★</span>
              <span>Maximum Luminary Tier Achieved · Apex Ecosystem Status</span>
            </div>
          )}
        </div>

        {/* 5-Tier Spec Matrix */}
        <div className="space-y-2">
          <div className="text-[10px] text-ink-faint uppercase font-bold tracking-wider flex items-center justify-between">
            <span>Ecosystem Level Specs</span>
            <span>Requirement</span>
          </div>

          <div className="space-y-1.5 max-h-[40vh] sm:max-h-none overflow-y-auto no-scrollbar">
            {FOUNDER_LEVELS.map((lvl) => {
              const isCurrent = lvl.level === scoreInfo.currentLevel.level;
              const isUnlocked = scoreInfo.points >= lvl.minPoints;
              const Icon = lvl.IconComponent;

              return (
                <div
                  key={lvl.level}
                  className={`p-2.5 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isCurrent
                      ? `${lvl.borderStyle} ${lvl.bgStyle}`
                      : isUnlocked
                      ? "border-hairline bg-surface/20"
                      : "border-hairline/60 bg-void/30 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 border border-hairline flex items-center justify-center bg-void ${lvl.textStyle} shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-ink truncate">{lvl.title}</span>
                        {isCurrent && (
                          <span className="text-[8px] px-1 py-0.2 border border-signal bg-void text-signal font-bold uppercase tracking-wider">
                            {isSelf ? "YOU" : "ACTIVE"}
                          </span>
                        )}
                        {isUnlocked && !isCurrent && (
                          <span className="text-[8px] px-1 py-0.2 border border-hairline text-ink-faint uppercase">
                            UNLOCKED
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-ink-dim font-sans truncate mt-0.5">
                        {lvl.perk}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0 text-[10px] font-bold text-ink-faint">
                    {lvl.minPoints === 0 ? "0 PTS" : `${lvl.minPoints}+ PTS`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Algorithmic Scoring Breakdown */}
        <div className="border-t border-hairline pt-3 space-y-1 text-[10px] text-ink-dim">
          <div className="text-[10px] font-bold text-ink uppercase tracking-wider">
            Scoring Formula:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[10px]">
            <div className="p-2 border border-hairline bg-surface/20">
              <span className="text-ink font-bold">+20 PTS</span>
              <p className="text-ink-faint text-[9px] mt-0.5">Per live product launched</p>
            </div>
            <div className="p-2 border border-hairline bg-surface/20">
              <span className="text-ink font-bold">+2 PTS</span>
              <p className="text-ink-faint text-[9px] mt-0.5">Per verified upvote</p>
            </div>
            <div className="p-2 border border-hairline bg-surface/20">
              <span className="text-ink font-bold">+1 PT / Day</span>
              <p className="text-ink-faint text-[9px] mt-0.5">Ecosystem age (max 90)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
