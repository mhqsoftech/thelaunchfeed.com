"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LaunchFeedLogo } from "@/components/ui/LaunchFeedLogo";
import { slugify } from "@/app/data";

interface BadgesClientViewProps {
  initialProduct?: string;
  initialAward?: string;
  eligibleAwardIds?: string[];
  isProductSpecific?: boolean;
  productName?: string;
}

type BadgeThemeId = "dark" | "light" | "signal" | "minimal";

interface BadgeTierDef {
  id: string;
  name: string;
  category: "daily" | "weekly" | "monthly" | "yearly" | "alltime" | "telemetry" | "launch";
  tag: string;
  description: string;
  rankBadge: string;
  statText: string;
}

const BADGE_TIERS: BadgeTierDef[] = [
  {
    id: "daily_1",
    name: "#1 Product of the Day",
    category: "daily",
    tag: "Daily Champion #1",
    description: "First-place winner of the daily 24-hour launch cycle",
    rankBadge: "#1 Daily",
    statText: "#1 DAILY",
  },
  {
    id: "daily_2",
    name: "#2 Product of the Day",
    category: "daily",
    tag: "Daily Finalist #2",
    description: "Second-place finalist of the daily launch cycle",
    rankBadge: "#2 Daily",
    statText: "#2 DAILY",
  },
  {
    id: "daily_3",
    name: "#3 Product of the Day",
    category: "daily",
    tag: "Daily Finalist #3",
    description: "Third-place finalist of the daily launch cycle",
    rankBadge: "#3 Daily",
    statText: "#3 DAILY",
  },
  {
    id: "weekly_1",
    name: "#1 Product of the Week",
    category: "weekly",
    tag: "Weekly Champion #1",
    description: "First-place top software product across the entire week",
    rankBadge: "#1 Weekly",
    statText: "#1 WEEKLY",
  },
  {
    id: "weekly_2",
    name: "#2 Product of the Week",
    category: "weekly",
    tag: "Weekly Finalist #2",
    description: "Second-place weekly leaderboard finalist",
    rankBadge: "#2 Weekly",
    statText: "#2 WEEKLY",
  },
  {
    id: "weekly_3",
    name: "#3 Product of the Week",
    category: "weekly",
    tag: "Weekly Finalist #3",
    description: "Third-place weekly leaderboard finalist",
    rankBadge: "#3 Weekly",
    statText: "#3 WEEKLY",
  },
  {
    id: "monthly_1",
    name: "#1 Product of the Month",
    category: "monthly",
    tag: "Monthly Champion #1",
    description: "Top software product of the monthly calendar cycle",
    rankBadge: "#1 Monthly",
    statText: "#1 MONTHLY",
  },
  {
    id: "monthly_2",
    name: "#2 Product of the Month",
    category: "monthly",
    tag: "Monthly Finalist #2",
    description: "Second-place monthly leaderboard finalist",
    rankBadge: "#2 Monthly",
    statText: "#2 MONTHLY",
  },
  {
    id: "monthly_3",
    name: "#3 Product of the Month",
    category: "monthly",
    tag: "Monthly Finalist #3",
    description: "Third-place monthly leaderboard finalist",
    rankBadge: "#3 Monthly",
    statText: "#3 MONTHLY",
  },
  {
    id: "yearly_1",
    name: "2026 Yearly Champion",
    category: "yearly",
    tag: "Sovereign Yearly #1",
    description: "Top software launch of the year 2026",
    rankBadge: "2026 Champion",
    statText: "#1 YEARLY",
  },
  {
    id: "alltime_1",
    name: "All-Time #1 GOAT",
    category: "alltime",
    tag: "Hall of Fame #1",
    description: "Greatest of all time top voted product on The Launch Feed",
    rankBadge: "GOAT #1",
    statText: "GOAT #1",
  },
  {
    id: "revenue",
    name: "Verified MRR Telemetry",
    category: "telemetry",
    tag: "Verified Stripe/Polar",
    description: "Cryptographically authenticated live revenue badge",
    rankBadge: "Verified MRR",
    statText: "VERIFIED",
  },
  {
    id: "upvote",
    name: "Community Upvotes",
    category: "telemetry",
    tag: "Upvote Telemetry",
    description: "Dynamic live upvote counter badge",
    rankBadge: "Top Voted",
    statText: "TOP VOTED",
  },
  {
    id: "launch",
    name: "Official Launch Badge",
    category: "launch",
    tag: "Live on TLF",
    description: "Standard badge for all live products on The Launch Feed",
    rankBadge: "Official",
    statText: "LIVE",
  },
];

const THEMES: { id: BadgeThemeId; label: string; tone: string }[] = [
  { id: "dark", label: "Dark Obsidian", tone: "bg-void text-ink border-hairline" },
  { id: "light", label: "Clean Light", tone: "bg-surface text-ink border-hairline" },
  { id: "signal", label: "Electric Signal", tone: "bg-signal/10 text-signal border-signal" },
  { id: "minimal", label: "Minimal Wireframe", tone: "bg-transparent text-ink-dim border-hairline" },
];

export default function BadgesClientView({
  initialProduct = "my-product",
  initialAward = "daily_1",
  eligibleAwardIds,
  isProductSpecific = false,
  productName,
}: BadgesClientViewProps) {
  const [productInput, setProductInput] = useState(initialProduct || "my-product");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Filter available tiers to ONLY those earned by the product if eligibleAwardIds are specified
  const availableTiers = React.useMemo(() => {
    if (!eligibleAwardIds || eligibleAwardIds.length === 0) {
      return BADGE_TIERS;
    }
    const set = new Set(eligibleAwardIds);
    if (set.has("pod")) set.add("daily_1");
    if (set.has("champion")) set.add("yearly_1");

    const filtered = BADGE_TIERS.filter((t) => set.has(t.id));
    return filtered.length > 0 ? filtered : BADGE_TIERS.filter((t) => t.id === "launch");
  }, [eligibleAwardIds]);

  // Secondary filter for category tabs when browsing all badges
  const displayedTiers = React.useMemo(() => {
    if (activeCategory === "all" || isProductSpecific) {
      return availableTiers;
    }
    if (activeCategory === "daily") {
      return availableTiers.filter((t) => t.category === "daily");
    }
    if (activeCategory === "weekly") {
      return availableTiers.filter((t) => t.category === "weekly");
    }
    if (activeCategory === "monthly") {
      return availableTiers.filter((t) => t.category === "monthly");
    }
    if (activeCategory === "champions") {
      return availableTiers.filter((t) => t.category === "yearly" || t.category === "alltime");
    }
    if (activeCategory === "telemetry") {
      return availableTiers.filter((t) => t.category === "telemetry" || t.category === "launch");
    }
    return availableTiers;
  }, [availableTiers, activeCategory, isProductSpecific]);

  const [selectedAward, setSelectedAward] = useState(() => {
    if (availableTiers.some((b) => b.id === initialAward)) {
      return initialAward;
    }
    return availableTiers[0]?.id || "launch";
  });

  const [selectedTheme, setSelectedTheme] = useState<BadgeThemeId>("dark");
  const [format, setFormat] = useState<"html" | "markdown" | "react" | "url">("html");
  const [copied, setCopied] = useState<string | null>(null);

  const cleanSlug = slugify(productInput) || "my-product";
  const badgeWidth = selectedAward === "launch" ? 220 : 284;
  const badgeHeight = 48;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://thelaunchfeed.com";
  const badgeImgUrl = `${baseUrl}/api/badge/${cleanSlug}?theme=${selectedTheme}&award=${selectedAward}`;
  const downloadUrl = `${baseUrl}/api/badge/${cleanSlug}?theme=${selectedTheme}&award=${selectedAward}&download=true`;
  const productUrl = `${baseUrl}/product/${cleanSlug}`;

  const htmlSnippet = `<a href="${productUrl}" target="_blank" rel="noopener noreferrer">
  <img 
    src="${badgeImgUrl}" 
    alt="${productName || productInput || "Product"} on The Launch Feed" 
    width="${badgeWidth}" 
    height="${badgeHeight}" 
  />
</a>`;

  const markdownSnippet = `[![${productName || productInput || "Product"} on The Launch Feed](${badgeImgUrl})](${productUrl})`;

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
        alt="${productName || productInput || "Product"} on The Launch Feed"
        width={${badgeWidth}}
        height={${badgeHeight}}
      />
    </a>
  );
}`;

  const currentSnippet =
    format === "html"
      ? htmlSnippet
      : format === "markdown"
      ? markdownSnippet
      : format === "react"
      ? reactSnippet
      : badgeImgUrl;

  const handleCopy = (text: string, fmt: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(fmt);
      setTimeout(() => setCopied(null), 3000);
    }
  };

  const currentTier = availableTiers.find((b) => b.id === selectedAward) || availableTiers[0] || BADGE_TIERS[0];

  return (
    <main className="min-h-screen bg-void text-ink font-mono px-3 sm:px-6 lg:px-8 py-4 sm:py-10 max-w-6xl mx-auto space-y-5 sm:space-y-8 w-full overflow-x-hidden">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="w-full min-w-0 flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-ink-dim border-b border-hairline pb-3 sm:pb-4 flex-wrap">
        <Link href="/" className="hover:text-ink transition-colors flex items-center gap-1 shrink-0">
          <span>Home</span>
        </Link>
        <span className="text-ink-faint shrink-0">/</span>
        <Link href="/badges" className="hover:text-ink transition-colors shrink-0">
          Badges
        </Link>
        {isProductSpecific && (
          <>
            <span className="text-ink-faint shrink-0">/</span>
            <Link href={`/product/${cleanSlug}`} className="hover:text-signal transition-colors font-bold text-ink truncate max-w-[140px] sm:max-w-[240px] md:max-w-none">
              {productName || cleanSlug}
            </Link>
          </>
        )}
        <span className="text-ink-faint shrink-0">/</span>
        <span className="text-ink font-bold truncate">Official Embed Badges</span>
      </nav>

      {/* Hero Header */}
      <div className="w-full border border-hairline bg-surface/30 p-3.5 sm:p-7 space-y-3 sm:space-y-4 rounded-xs min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <LaunchFeedLogo size={28} />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-signal truncate">
                {isProductSpecific ? "Verified Product Accolades" : "Vector Telemetry Assets"}
              </div>
              <h1 className="text-base sm:text-2xl lg:text-3xl font-bold text-ink truncate">
                {isProductSpecific
                  ? `${productName || productInput} Awards & Trophies`
                  : "Official Award Badges & Trophies"}
              </h1>
            </div>
          </div>

          {isProductSpecific && (
            <Link
              href={`/product/${cleanSlug}`}
              className="w-full sm:w-auto text-center px-3.5 py-2 border border-signal text-signal hover:bg-signal hover:text-void font-bold text-xs uppercase transition-colors shrink-0 rounded-xs"
            >
              View Live Product Page ↗
            </Link>
          )}
        </div>

        <p className="text-xs sm:text-sm text-ink-dim max-w-2xl leading-relaxed">
          {isProductSpecific
            ? `Displaying official embeddable badges and trophies unlocked by ${productName || productInput}. Select any earned award tier below to generate live embed codes or download vector SVG assets.`
            : "Embed live vector SVG badges into your landing page, GitHub README, or product documentation. Badges update dynamically with your live votes, daily/weekly/monthly rank, and verified revenue telemetry."}
        </p>

        {/* Product Slug / Name Display */}
        {!isProductSpecific && (
          <div className="pt-1 max-w-md space-y-1 w-full min-w-0">
            <label className="block text-[10px] sm:text-[11px] font-bold uppercase text-ink-dim">
              Your Product Name or Slug:
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
              <input
                type="text"
                value={productInput}
                onChange={(e) => setProductInput(e.target.value)}
                placeholder="e.g. my-awesome-tool"
                className="w-full sm:flex-1 px-3 py-2 border border-hairline bg-surface text-ink text-xs font-mono font-bold focus:border-signal outline-none rounded-xs min-w-0"
              />
              <span className="text-[10px] text-ink-faint shrink-0 truncate max-w-full">
                Slug: <code className="text-signal font-bold bg-surface px-1.5 py-0.5 border border-hairline rounded-xs">{cleanSlug}</code>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 min-w-0">
        {/* Left: Badge Tier Selector */}
        <div className="lg:col-span-5 space-y-2.5 sm:space-y-3 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-ink flex items-center justify-between border-b border-hairline pb-2">
            <span>{isProductSpecific ? "1. Select Earned Award" : "1. Select Award Badge Tier"}</span>
            <span className={`text-[10px] font-bold ${isProductSpecific ? "text-signal" : "text-ink-dim"}`}>
              {displayedTiers.length} {displayedTiers.length === 1 ? "Award" : "Awards"} {isProductSpecific && "Eligible"}
            </span>
          </div>

          {/* Category Filter Pills (When browsing all tiers) */}
          {!isProductSpecific && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-[10px] font-mono">
              {[
                { id: "all", label: "All" },
                { id: "daily", label: "Daily" },
                { id: "weekly", label: "Weekly" },
                { id: "monthly", label: "Monthly" },
                { id: "champions", label: "Champions" },
                { id: "telemetry", label: "MRR & Votes" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2 py-1 uppercase font-bold border shrink-0 transition-colors rounded-xs cursor-pointer ${
                    activeCategory === cat.id
                      ? "border-signal bg-signal text-void"
                      : "border-hairline bg-surface/30 text-ink-dim hover:text-ink hover:bg-surface"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5 max-h-[280px] sm:max-h-[500px] overflow-y-auto no-scrollbar pr-0.5 sm:pr-1">
            {displayedTiers.map((tier) => {
              const isSelected = selectedAward === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedAward(tier.id)}
                  className={`w-full p-2 sm:p-2.5 border text-left transition-all cursor-pointer flex items-center justify-between gap-2 rounded-xs min-w-0 ${
                    isSelected
                      ? "border-signal bg-surface text-ink shadow-xs"
                      : "border-hairline bg-surface/20 text-ink-dim hover:bg-surface/60 hover:text-ink"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate text-ink flex items-center gap-1.5">
                      <span>{tier.name}</span>
                    </div>
                    <div className="text-[10px] text-ink-dim truncate mt-0.5">{tier.description}</div>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 border uppercase shrink-0 whitespace-nowrap rounded-xs ${
                      isSelected
                        ? "border-signal text-signal bg-signal/10"
                        : "border-hairline text-ink-dim bg-surface"
                    }`}
                  >
                    {tier.rankBadge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Live Preview & Generator */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-6 min-w-0">
          {/* Theme Selector */}
          <div className="space-y-2 min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-ink flex items-center justify-between border-b border-hairline pb-2">
              <span>2. Select Color Theme</span>
              <span className="text-[10px] text-ink-dim">{selectedTheme.toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setSelectedTheme(th.id)}
                  className={`p-2 sm:p-2.5 border text-left text-xs font-bold transition-all cursor-pointer rounded-xs min-w-0 ${
                    selectedTheme === th.id
                      ? "border-signal bg-surface text-ink shadow-xs"
                      : "border-hairline bg-surface/30 text-ink-dim hover:bg-surface hover:text-ink"
                  }`}
                >
                  <div className="truncate">{th.label}</div>
                  <div className="text-[9px] uppercase font-normal text-ink-dim mt-0.5 truncate">
                    {th.id}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Display Card */}
          <div className="w-full border border-hairline bg-surface/20 p-3.5 sm:p-6 space-y-3 sm:space-y-4 rounded-xs min-w-0">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase text-ink flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                <span>Live Vector Preview</span>
              </div>
              <span className="text-[10px] text-ink-dim font-mono">
                {badgeWidth} &times; {badgeHeight} SVG
              </span>
            </div>

            <div className="w-full p-3 sm:p-8 border border-hairline bg-void flex items-center justify-center min-h-[84px] sm:min-h-[120px] overflow-hidden rounded-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`${cleanSlug}-${selectedTheme}-${selectedAward}`}
                src={`/api/badge/${cleanSlug}?theme=${selectedTheme}&award=${selectedAward}&_t=${selectedTheme}-${selectedAward}`}
                alt={`${productInput} Badge Preview`}
                width={badgeWidth}
                height={badgeHeight}
                className="max-w-full w-auto h-auto max-h-[48px] sm:max-h-[56px] object-contain drop-shadow-sm transition-all"
              />
            </div>

            {/* Instant Actions Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-3 border-t border-hairline/60 w-full">
              <a
                href={downloadUrl}
                download
                className="w-full sm:w-auto px-3.5 py-2 bg-signal text-void font-bold text-xs uppercase flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shadow-xs rounded-xs"
              >
                <span>↓ Download SVG Asset</span>
              </a>

              <a
                href={badgeImgUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-3.5 py-2 border border-hairline hover:border-ink bg-surface hover:bg-raised text-ink font-bold text-xs uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer rounded-xs"
              >
                <span>Open Vector URL ↗</span>
              </a>

              <span className="text-[10px] sm:text-xs text-ink-dim text-center sm:text-right sm:ml-auto pt-1 sm:pt-0 truncate max-w-full">
                Badge: <strong className="text-ink">{currentTier.name}</strong>
              </span>
            </div>
          </div>

          {/* Embed Code Generator */}
          <div className="w-full border border-hairline bg-void p-3.5 sm:p-5 space-y-3 rounded-xs min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline pb-2.5">
              <label className="text-xs font-bold text-ink uppercase tracking-wider">
                3. Copy Embed Snippet
              </label>
              <div className="grid grid-cols-4 sm:flex items-center gap-1 w-full sm:w-auto">
                {(["html", "markdown", "react", "url"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`px-2 py-1 text-[10px] font-mono font-bold uppercase border transition-colors cursor-pointer text-center rounded-xs truncate ${
                      format === fmt
                        ? "border-signal bg-signal text-void"
                        : "border-hairline bg-surface text-ink-dim hover:text-ink"
                    }`}
                  >
                    {fmt === "url" ? "URL" : fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                readOnly
                value={currentSnippet}
                rows={format === "react" ? 6 : 4}
                className="w-full border border-hairline bg-surface/30 p-2.5 sm:p-3 text-[11px] sm:text-xs font-mono text-signal font-bold focus:outline-none resize-none leading-relaxed rounded-xs break-all sm:break-normal"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleCopy(currentSnippet, format)}
                  className="w-full sm:w-auto px-4 py-2 bg-ink text-void text-xs font-mono font-bold uppercase hover:bg-ink-dim transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md rounded-xs"
                >
                  {copied === format ? (
                    <span className="text-signal font-bold">✓ Copied {format.toUpperCase()}!</span>
                  ) : (
                    <span>Copy {format.toUpperCase()} Code</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Navigation */}
      <div className="border-t border-hairline pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-dim font-mono">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs font-mono font-bold text-ink transition-colors cursor-pointer group rounded-xs w-full sm:w-auto justify-center"
        >
          <span className="text-signal group-hover:-translate-x-0.5 transition-transform">←</span>
          <span>Back to Leaderboards</span>
        </Link>
        <div className="flex items-center gap-3 text-xs flex-wrap justify-center">
          <Link href="/about" className="hover:text-signal transition-colors">About</Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-signal transition-colors">Terms</Link>
          <span>&middot;</span>
          <Link href="/privacy" className="hover:text-signal transition-colors">Privacy</Link>
          <span>&middot;</span>
          <Link href="/contact" className="hover:text-signal transition-colors">Contact</Link>
        </div>
      </div>
    </main>
  );
}
