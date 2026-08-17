"use client";

import React, { useState } from "react";
import { slugify } from "@/app/data";
import { LaunchFeedLogo } from "@/components/ui/LaunchFeedLogo";

export type EmbedAwardId =
  | "launch"
  | "pod"
  | "daily_1"
  | "daily_2"
  | "daily_3"
  | "weekly_1"
  | "weekly_2"
  | "weekly_3"
  | "monthly_1"
  | "monthly_2"
  | "monthly_3"
  | "champion"
  | "yearly_1"
  | "yearly_2"
  | "yearly_3"
  | "alltime_1"
  | "alltime_2"
  | "alltime_3"
  | "revenue"
  | "upvote";

export type EmbedThemeId = "dark" | "light" | "signal" | "minimal";

interface EmbeddableAwardWidgetProps {
  productName: string;
  votes: number;
  revenue?: string;
  /** Award tiers this product has actually earned. The default "launch"
   *  badge is always available and doesn't need to be listed here. */
  eligibleAwards?: EmbedAwardId[];
}

const ALL_AWARDS: {
  id: EmbedAwardId;
  name: string;
  tag: string;
  description: string;
}[] = [
  { id: "launch", name: "Launched on TLF", tag: "Official Launch", description: "Proof of shipment on The Launch Feed" },
  { id: "daily_1", name: "#1 Product of the Day", tag: "Apex Daily #1", description: "First-place daily leaderboard finisher" },
  { id: "daily_2", name: "#2 Product of the Day", tag: "Radiant Daily #2", description: "Second-place daily leaderboard finisher" },
  { id: "daily_3", name: "#3 Product of the Day", tag: "Bronze Daily #3", description: "Third-place daily leaderboard finisher" },
  { id: "weekly_1", name: "#1 Product of the Week", tag: "Weekly Leader #1", description: "First-place weekly leaderboard finisher" },
  { id: "weekly_2", name: "#2 Product of the Week", tag: "Weekly Finalist #2", description: "Second-place weekly leaderboard finisher" },
  { id: "weekly_3", name: "#3 Product of the Week", tag: "Weekly Finalist #3", description: "Third-place weekly leaderboard finisher" },
  { id: "monthly_1", name: "#1 Product of the Month", tag: "Monthly Star #1", description: "Top software tool of the month" },
  { id: "monthly_2", name: "#2 Product of the Month", tag: "Monthly Finalist #2", description: "Second-place monthly leaderboard finisher" },
  { id: "monthly_3", name: "#3 Product of the Month", tag: "Monthly Finalist #3", description: "Third-place monthly leaderboard finisher" },
  { id: "yearly_1", name: "2026 Yearly Champion", tag: "Yearly Crown #1", description: "Annual leaderboard champion" },
  { id: "yearly_2", name: "2026 Yearly Finalist #2", tag: "Yearly Crest #2", description: "Annual leaderboard 2nd place" },
  { id: "yearly_3", name: "2026 Yearly Finalist #3", tag: "Yearly Medal #3", description: "Annual leaderboard 3rd place" },
  { id: "alltime_1", name: "All-Time #1 GOAT", tag: "Hall of Fame #1", description: "Cumulative all-time #1 champion" },
  { id: "alltime_2", name: "All-Time #2 Aegis", tag: "Hall of Fame #2", description: "Cumulative all-time 2nd place" },
  { id: "alltime_3", name: "All-Time #3 Laurel", tag: "Hall of Fame #3", description: "Cumulative all-time 3rd place" },
  { id: "revenue", name: "MRR Telemetry", tag: "Stripe Telemetry", description: "Real-time revenue telemetry proof" },
  { id: "upvote", name: "Community Upvotes", tag: "Upvote Counter", description: "Live upvote telemetry counter" },
];

const THEMES: {
  id: EmbedThemeId;
  name: string;
  accent: string;
  previewBg: string;
}[] = [
  { id: "dark", name: "Dark Obsidian", accent: "text-signal", previewBg: "bg-void" },
  { id: "light", name: "Clean Light", accent: "text-ink", previewBg: "bg-[#f4f4f5]" },
  { id: "signal", name: "Electric Signal", accent: "text-signal", previewBg: "bg-[#180c06]" },
  { id: "minimal", name: "Minimal Wireframe", accent: "text-ink-dim", previewBg: "bg-void" },
];

export default function EmbeddableAwardWidget({
  productName,
  votes,
  revenue,
  eligibleAwards = ["launch"],
}: EmbeddableAwardWidgetProps) {
  // Normalize legacy award names (pod -> daily_1, champion -> yearly_1)
  const normalizedEligible = eligibleAwards.map((a) => {
    if (a === "pod") return "daily_1";
    if (a === "champion") return "yearly_1";
    return a;
  });

  const eligibleSet = new Set<EmbedAwardId>([...normalizedEligible, "launch"]);
  const availableAwards = ALL_AWARDS.filter((a) => eligibleSet.has(a.id));
  const [selectedAward, setSelectedAward] = useState<EmbedAwardId>(
    availableAwards[0]?.id ?? "launch"
  );
  const [selectedTheme, setSelectedTheme] = useState<EmbedThemeId>("dark");
  const [selectedFormat, setSelectedFormat] = useState<
    "html" | "markdown" | "react" | "url"
  >("html");
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const productSlug = slugify(productName);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://thelaunchfeed.com";
  const badgeImgUrl = `${baseUrl}/api/badge/${productSlug}?theme=${selectedTheme}&award=${selectedAward}`;
  const productUrl = `${baseUrl}/product/${productSlug}`;

  const badgeWidth = selectedAward === "launch" ? 220 : 284;
  const badgeHeight = 48;

  // Generated Code Snippets for selected award, theme & format
  const htmlSnippet = `<a href="${productUrl}" target="_blank" rel="noopener noreferrer">
  <img 
    src="${badgeImgUrl}" 
    alt="${productName} - Official Badge on The Launch Feed" 
    width="${badgeWidth}" 
    height="${badgeHeight}" 
  />
</a>`;

  const markdownSnippet = `[![${productName} on The Launch Feed](${badgeImgUrl})](${productUrl})`;

  const reactSnippet = `import React from 'react';

export function LaunchFeedBadge() {
  return (
    <a 
      href="${productUrl}" 
      target="_blank" 
      rel="noopener noreferrer"
      style={{ display: 'inline-block' }}
    >
      <img
        src="${badgeImgUrl}"
        alt="${productName} on The Launch Feed"
        width={${badgeWidth}}
        height={${badgeHeight}}
      />
    </a>
  );
}`;

  const currentCode =
    selectedFormat === "html"
      ? htmlSnippet
      : selectedFormat === "markdown"
      ? markdownSnippet
      : selectedFormat === "react"
      ? reactSnippet
      : badgeImgUrl;

  const handleCopy = (codeText: string, formatKey: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(codeText);
      setCopiedFormat(formatKey);
      setTimeout(() => setCopiedFormat(null), 3000);
    }
  };

  return (
    <div className="border border-hairline bg-void p-4 sm:p-6 space-y-6 font-mono text-ink">
      {/* Widget Header with Official TLF Logo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-hairline pb-3 gap-2">
        <div className="flex items-center gap-3">
          <LaunchFeedLogo size={24} />
          <div>
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <span>Embeddable Award Badges</span>
              <span className="text-[9px] font-mono px-2 py-0.5 border border-signal text-signal bg-signal/10 uppercase">
                Official Embed SDK
              </span>
            </h3>
            <p className="text-[10px] text-ink-dim mt-0.5">
              Vector-rendered badges for your landing page, GitHub repo, or docs
            </p>
          </div>
        </div>
      </div>

      {/* 1. Theme / Style Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink">
          <span>1. Choose Design Style</span>
          <span className="text-[10px] text-ink-dim font-normal">
            4 responsive styles
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {THEMES.map((th) => {
            const isSelected = selectedTheme === th.id;
            return (
              <button
                key={th.id}
                type="button"
                onClick={() => setSelectedTheme(th.id)}
                className={`p-2.5 border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "border-signal bg-surface text-ink font-bold shadow-sm"
                    : "border-hairline bg-surface/30 text-ink-dim hover:bg-surface hover:text-ink"
                }`}
              >
                <div className="text-[11px] font-bold">{th.name}</div>
                <div className={`text-[9px] uppercase font-mono mt-1 ${th.accent}`}>
                  {th.id} theme
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Award Tier Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink">
          <span>2. Choose Award Badge Tier</span>
          <span className="text-[10px] text-ink-dim font-normal">
            {availableAwards.length} available tier{availableAwards.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {availableAwards.map((award) => {
            const isSelected = selectedAward === award.id;
            return (
              <button
                key={award.id}
                type="button"
                onClick={() => setSelectedAward(award.id)}
                className={`p-2.5 border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "border-signal bg-surface text-ink font-bold shadow-sm"
                    : "border-hairline bg-surface/30 text-ink-dim hover:bg-surface hover:text-ink"
                }`}
              >
                <div>
                  <div className="text-[11px] font-bold truncate">{award.name}</div>
                  <div className="text-[9px] text-ink-dim mt-0.5">{award.description}</div>
                </div>
                <div className="text-[9px] uppercase font-mono mt-2 text-signal font-bold">
                  {award.tag}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Badge Preview Stage */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-ink uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-signal shrink-0" />
            <span>Badge Preview</span>
          </span>
          <span className="text-[10px] text-ink-dim font-mono font-normal">
            {badgeWidth} &times; {badgeHeight} SVG
          </span>
        </div>

        {/* ─── BADGE DISPLAY CARD ─── */}
        <div className="p-6 border border-hairline bg-surface/20 flex flex-col items-center justify-center min-h-[90px] overflow-x-auto gap-4">
          {/* Real rendered vector SVG from endpoint */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`${selectedTheme}-${selectedAward}`}
            src={`/api/badge/${productSlug}?theme=${selectedTheme}&award=${selectedAward}&_t=${selectedTheme}-${selectedAward}`}
            alt={`${productName} Badge Preview`}
            width={badgeWidth}
            height={badgeHeight}
            className="block max-w-full h-auto"
          />

          <div className="flex items-center gap-2 pt-2 border-t border-hairline/60 w-full justify-center">
            <a
              href={`/api/badge/${productSlug}?theme=${selectedTheme}&award=${selectedAward}&download=true`}
              download
              className="px-3.5 py-1.5 bg-signal text-void text-[10px] font-mono font-bold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs"
            >
              <span>↓ Download SVG Asset</span>
            </a>
            <a
              href={`/badges/${productSlug}`}
              className="px-3 py-1.5 border border-hairline hover:border-ink bg-void text-ink text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
            >
              <span>View Full Trophy Kit ↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Code Format Selector & Copy Snippet Box */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-ink uppercase tracking-wider">
            3. Copy Embed Code
          </label>
          <div className="flex items-center gap-1">
            {(["html", "markdown", "react", "url"] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setSelectedFormat(fmt)}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase border transition-colors cursor-pointer ${
                  selectedFormat === fmt
                    ? "border-signal bg-signal text-void"
                    : "border-hairline bg-surface text-ink-dim hover:text-ink"
                }`}
              >
                {fmt === "url" ? "Direct URL" : fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Code Snippet Box */}
        <div className="relative">
          <textarea
            readOnly
            value={currentCode}
            rows={selectedFormat === "react" ? 5 : 4}
            className="w-full border border-hairline bg-void p-3 text-xs font-mono text-signal font-bold focus:outline-none resize-none leading-relaxed"
          />

          <button
            type="button"
            onClick={() => handleCopy(currentCode, selectedFormat)}
            className="absolute top-2.5 right-2.5 px-3 py-1.5 bg-ink text-void text-xs font-mono font-bold uppercase hover:bg-ink-dim transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
          >
            {copiedFormat === selectedFormat ? (
              <span className="text-signal font-bold flex items-center gap-1">
                ✓ Copied {selectedFormat.toUpperCase()}!
              </span>
            ) : (
              <span>Copy {selectedFormat.toUpperCase()}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
