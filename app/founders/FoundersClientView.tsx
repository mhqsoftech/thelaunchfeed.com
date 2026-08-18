"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import MainLayoutShell from "@/app/MainLayoutShell";
import { slugify, getStoredSession, UserSession } from "@/app/data";
import {
  FOUNDER_LEVELS,
  FounderLevelBreakdownModal,
  getFounderScore,
} from "@/app/components/FounderLevelBadge";
import type { TopFounderItem } from "@/lib/queries/founders";

export default function FoundersClientView({
  founders,
}: {
  founders: TopFounderItem[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<number | "ALL">("ALL");
  const [inspectingFounder, setInspectingFounder] = useState<TopFounderItem | null>(null);
  const [userSession, setUserSession] = useState<UserSession | null>(null);

  useEffect(() => {
    setUserSession(getStoredSession());
    const handleAuthChange = (e: Event) => {
      const customEv = e as CustomEvent<UserSession | null>;
      setUserSession(customEv.detail !== undefined ? customEv.detail : getStoredSession());
    };
    window.addEventListener("authChanged", handleAuthChange);
    return () => window.removeEventListener("authChanged", handleAuthChange);
  }, []);

  const inspectingIsSelf = useMemo(() => {
    if (!userSession || !inspectingFounder) return false;
    if (inspectingFounder.id && userSession.id && userSession.id === inspectingFounder.id) return true;
    const sessionHandle = (userSession.handle || "").toLowerCase().replace(/^@/, "").trim();
    const founderHandle = (inspectingFounder.username || "").toLowerCase().replace(/^@/, "").trim();
    return !!(sessionHandle && founderHandle && sessionHandle === founderHandle);
  }, [userSession, inspectingFounder]);

  const filteredFounders = useMemo(() => {
    let list = founders;

    if (selectedLevel !== "ALL") {
      list = list.filter((f) => f.level.level === selectedLevel);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.username.toLowerCase().includes(q) ||
          (f.title && f.title.toLowerCase().includes(q)) ||
          (f.bio && f.bio.toLowerCase().includes(q)) ||
          f.topProducts.some((p) => p.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [founders, selectedLevel, searchQuery]);

  return (
    <MainLayoutShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-16 font-mono text-ink w-full min-w-0">
        {/* Sticky Sub-Header matching site standard */}
        <div className="sticky -top-4 z-30 bg-void -mt-4 pt-4 border-b border-hairline shrink-0">
          <div className="h-10 flex items-end justify-between pb-2.5 w-full">
            <Link
              href="/"
              className="font-mono text-xs text-ink-dim hover:text-ink transition-colors flex items-center gap-1.5 shrink-0"
            >
              <span>←</span>
              <span>Back to Feed</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border border-signal/40 bg-signal/5 text-signal rounded-xs">
                TOP 100 BUILDERS
              </span>
            </div>
          </div>
        </div>

        {/* Hero Header */}
        <div className="border border-hairline p-4 sm:p-6 bg-surface/30 space-y-4 w-full min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-signal font-bold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-signal animate-pulse shrink-0" />
                <span>Founder Prestige Index</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-black text-ink tracking-tight mt-1 truncate">
                Top 100 Founders & Makers
              </h1>
              <p className="text-xs sm:text-sm text-ink-dim mt-1 max-w-2xl leading-relaxed">
                Ranked dynamically by software launched, cumulative community votes, and ecosystem longevity.
              </p>
            </div>
            <div className="border border-hairline p-2.5 sm:p-3 bg-surface/60 space-y-1 sm:text-right shrink-0 w-full sm:w-auto">
              <div className="text-[10px] uppercase font-bold text-ink-faint">Scoring Formula</div>
              <div className="text-[11px] font-mono text-ink-dim">
                <span className="text-signal font-bold">20 PTS</span> / Product + <span className="text-signal font-bold">2 PTS</span> / Vote
              </div>
            </div>
          </div>

          {/* Search & Level Filter Controls */}
          <div className="pt-2 flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full min-w-0">
            <div className="h-10 w-full md:flex-1 border border-hairline bg-surface px-3 flex items-center gap-2 focus-within:border-ink transition-colors min-w-0">
              <span className="text-ink-faint text-xs shrink-0">⌕</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="search by name, handle, company, or product..."
                className="w-full min-w-0 bg-transparent text-ink font-mono text-xs placeholder:text-ink-faint focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-ink-faint hover:text-ink px-1 cursor-pointer shrink-0"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Level Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 shrink-0 no-scrollbar">
              <button
                onClick={() => setSelectedLevel("ALL")}
                className={`h-10 px-3 border text-xs font-mono font-bold transition-colors cursor-pointer shrink-0 ${
                  selectedLevel === "ALL"
                    ? "border-signal/40 bg-signal/10 text-signal"
                    : "border-hairline bg-surface hover:bg-raised text-ink-dim hover:text-ink"
                }`}
              >
                All ({founders.length})
              </button>
              {FOUNDER_LEVELS.map((lvl) => (
                <button
                  key={lvl.level}
                  onClick={() => setSelectedLevel(lvl.level)}
                  className={`h-10 px-2.5 sm:px-3 border text-xs font-mono font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                    selectedLevel === lvl.level
                      ? `${lvl.borderStyle} ${lvl.bgStyle} ${lvl.textStyle}`
                      : "border-hairline bg-surface hover:bg-raised text-ink-dim hover:text-ink"
                  }`}
                >
                  <span>L{lvl.level}</span>
                  <span className="hidden sm:inline">{lvl.title.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Podium for Top 3 (if not searching / filtered to specific search) */}
        {!searchQuery && selectedLevel === "ALL" && founders.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 pt-1 w-full min-w-0">
            {/* #2 Rank */}
            {founders[1] && (
              <div className="order-2 md:order-1 border border-hairline bg-surface/30 p-3.5 sm:p-4 relative space-y-3 flex flex-col justify-between hover:border-ink/30 transition-all min-w-0 overflow-hidden">
                <div className="flex items-start justify-between gap-2 min-w-0 w-full">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                    <span className="font-display font-black text-xl sm:text-2xl text-ink-dim shrink-0">#02</span>
                    <Link href={`/founder/${slugify(founders[1].name)}`} aria-label={founders[1].name} className="w-10 h-10 sm:w-11 sm:h-11 rounded-xs bg-void border border-hairline overflow-hidden shrink-0 block"
                    >
                      {founders[1].image ? (
                        <img width="64" height="64" src={founders[1].image} alt={founders[1].name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs">
                          {founders[1].name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <Link
                        href={`/founder/${slugify(founders[1].name)}`}
                        className="text-xs sm:text-sm font-bold text-ink hover:text-signal transition-colors block leading-tight truncate"
                      >
                        {founders[1].name}
                      </Link>
                      <div className="text-[10px] text-ink-dim truncate mt-0.5">
                        {founders[1].title || `@${founders[1].username}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setInspectingFounder(founders[1])}
                    className="text-right cursor-pointer shrink-0 pl-1"
                  >
                    <div className="text-xs sm:text-sm font-bold text-ink whitespace-nowrap">{founders[1].points} PTS</div>
                    <div className="text-[9px] uppercase font-bold text-ink-faint whitespace-nowrap">Level {founders[1].level.level}</div>
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-dim border-t border-hairline/80 pt-2">
                  <span>{founders[1].productsCount} launched</span>
                  <span>{founders[1].totalVotes} votes</span>
                </div>
              </div>
            )}

            {/* #1 Rank (Center Prominent) */}
            {founders[0] && (
              <div className="order-1 md:order-2 border-2 border-signal/50 bg-signal/5 p-3.5 sm:p-4 relative space-y-3 flex flex-col justify-between shadow-lg shadow-signal/5 min-w-0 overflow-hidden">
                <div className="flex items-start justify-between gap-2 min-w-0 w-full">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                    <span className="font-display font-black text-2xl sm:text-3xl text-signal shrink-0">#01</span>
                    <Link href={`/founder/${slugify(founders[0].name)}`} aria-label={founders[0].name} className="w-11 h-11 sm:w-12 sm:h-12 rounded-xs bg-void border border-signal/40 overflow-hidden shrink-0 block"
                    >
                      {founders[0].image ? (
                        <img width="64" height="64" src={founders[0].image} alt={founders[0].name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-sm">
                          {founders[0].name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <Link
                        href={`/founder/${slugify(founders[0].name)}`}
                        className="text-sm sm:text-base font-bold text-ink hover:text-signal transition-colors block leading-tight truncate"
                      >
                        {founders[0].name}
                      </Link>
                      <div className="text-[10px] sm:text-[11px] text-ink-dim truncate mt-0.5">
                        {founders[0].title || `@${founders[0].username}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setInspectingFounder(founders[0])}
                    className="text-right cursor-pointer shrink-0 pl-1"
                  >
                    <div className="text-sm sm:text-base font-black text-signal whitespace-nowrap">{founders[0].points} PTS</div>
                    <div className="text-[9px] uppercase font-bold text-signal/80 whitespace-nowrap">★ Champion</div>
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-dim border-t border-signal/20 pt-2">
                  <span>{founders[0].productsCount} launched</span>
                  <span className="text-signal font-bold">{founders[0].totalVotes} votes</span>
                </div>
              </div>
            )}

            {/* #3 Rank */}
            {founders[2] && (
              <div className="order-3 border border-hairline bg-surface/30 p-3.5 sm:p-4 relative space-y-3 flex flex-col justify-between hover:border-ink/30 transition-all min-w-0 overflow-hidden">
                <div className="flex items-start justify-between gap-2 min-w-0 w-full">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                    <span className="font-display font-black text-xl sm:text-2xl text-ink-dim shrink-0">#03</span>
                    <Link href={`/founder/${slugify(founders[2].name)}`} aria-label={founders[2].name} className="w-10 h-10 sm:w-11 sm:h-11 rounded-xs bg-void border border-hairline overflow-hidden shrink-0 block"
                    >
                      {founders[2].image ? (
                        <img width="64" height="64" src={founders[2].image} alt={founders[2].name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs">
                          {founders[2].name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <Link
                        href={`/founder/${slugify(founders[2].name)}`}
                        className="text-xs sm:text-sm font-bold text-ink hover:text-signal transition-colors block leading-tight truncate"
                      >
                        {founders[2].name}
                      </Link>
                      <div className="text-[10px] text-ink-dim truncate mt-0.5">
                        {founders[2].title || `@${founders[2].username}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setInspectingFounder(founders[2])}
                    className="text-right cursor-pointer shrink-0 pl-1"
                  >
                    <div className="text-xs sm:text-sm font-bold text-ink whitespace-nowrap">{founders[2].points} PTS</div>
                    <div className="text-[9px] uppercase font-bold text-ink-faint whitespace-nowrap">Level {founders[2].level.level}</div>
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-dim border-t border-hairline/80 pt-2">
                  <span>{founders[2].productsCount} launched</span>
                  <span>{founders[2].totalVotes} votes</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full Leaderboard Table */}
        <div className="border border-hairline bg-void w-full min-w-0 overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-hairline bg-surface/40 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-ink">
              Rankings ({filteredFounders.length} Builders)
            </div>
            <div className="text-[10px] text-ink-dim font-mono hidden sm:block">
              Live updates from community votes & launches
            </div>
          </div>

          <div className="divide-y divide-hairline">
            {filteredFounders.map((founder) => (
              <div
                key={founder.id}
                className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/30 transition-colors w-full min-w-0"
              >
                {/* Left: Rank + Avatar + Name + Title */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 overflow-hidden">
                  <span
                    className={`font-display font-black text-sm sm:text-base md:text-lg w-6 sm:w-7 text-right shrink-0 pt-0.5 sm:pt-0 ${
                      founder.rank === 1
                        ? "text-signal"
                        : founder.rank <= 3
                        ? "text-ink"
                        : "text-ink-faint"
                    }`}
                  >
                    {String(founder.rank).padStart(2, "0")}
                  </span>

                  <Link
                    href={`/founder/${slugify(founder.name)}`}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xs bg-surface border border-hairline shrink-0 overflow-hidden flex items-center justify-center font-bold text-xs"
                  >
                    {founder.image ? (
                      <img width="64" height="64" src={founder.image} alt={founder.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      founder.name.substring(0, 2).toUpperCase()
                    )}
                  </Link>

                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <Link
                        href={`/founder/${slugify(founder.name)}`}
                        className="text-xs sm:text-sm font-bold text-ink hover:text-signal transition-colors truncate max-w-[140px] sm:max-w-[200px]"
                      >
                        {founder.name}
                      </Link>
                      <Link
                        href={`/founder/${slugify(founder.name)}`}
                        className="text-[10px] sm:text-[11px] text-ink-dim hover:text-ink transition-colors truncate max-w-[100px] sm:max-w-[140px]"
                      >
                        @{founder.username}
                      </Link>

                      {/* Level Badge Pill */}
                      <button
                        onClick={() => setInspectingFounder(founder)}
                        className={`text-[8.5px] sm:text-[9px] font-mono px-1.5 py-0.2 border font-bold uppercase transition-transform hover:scale-105 cursor-pointer shrink-0 ${founder.level.borderStyle} ${founder.level.bgStyle} ${founder.level.textStyle}`}
                      >
                        Lvl 0{founder.level.level} · {founder.level.shortCode || founder.level.title.split(" ")[0]}
                      </button>
                    </div>

                    {founder.title && (
                      <p className="text-[10.5px] sm:text-[11px] text-ink-dim truncate mt-0.5 max-w-full">
                        {founder.title}
                      </p>
                    )}

                    {/* Top Products Quick Pills */}
                    {founder.topProducts.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[9.5px] sm:text-[10px] text-ink-faint shrink-0">Products:</span>
                        {founder.topProducts.map((p) => (
                          <Link
                            key={p.slug}
                            href={`/product/${p.slug}`}
                            className="text-[9.5px] sm:text-[10px] px-1.5 py-0.5 border border-hairline bg-surface hover:bg-raised text-ink transition-colors truncate max-w-[110px] sm:max-w-[160px]"
                          >
                            {p.name} ({p.voteCount})
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Stats & Points Pill */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pl-9 sm:pl-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline/60 w-full sm:w-auto">
                  <div className="text-left sm:text-right text-[10px] sm:text-[11px] text-ink-dim shrink-0">
                    <div><span className="font-bold text-ink">{founder.productsCount}</span> {founder.productsCount === 1 ? "launch" : "launches"}</div>
                    <div className="text-ink-faint text-[9.5px] sm:text-[10px]">{founder.totalVotes} total votes</div>
                  </div>

                  <button
                    onClick={() => setInspectingFounder(founder)}
                    className="px-2.5 sm:px-3 py-1.5 border border-hairline bg-surface hover:bg-raised text-right transition-colors cursor-pointer group shrink-0"
                  >
                    <div className="text-xs sm:text-sm font-bold font-display text-ink group-hover:text-signal transition-colors">
                      {founder.points} PTS
                    </div>
                    <div className="text-[8.5px] sm:text-[9px] uppercase font-mono text-ink-faint">
                      Breakdown →
                    </div>
                  </button>
                </div>
              </div>
            ))}

            {filteredFounders.length === 0 && (
              <div className="p-8 sm:p-12 text-center text-xs text-ink-dim space-y-2">
                <div>No builders found matching &ldquo;{searchQuery}&rdquo;.</div>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedLevel("ALL");
                  }}
                  className="text-signal hover:underline cursor-pointer"
                >
                  Clear search filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal for Founder Score Breakdown */}
        {inspectingFounder && (
          <FounderLevelBreakdownModal
            scoreInfo={getFounderScore(
              inspectingFounder.productsCount,
              inspectingFounder.totalVotes,
              inspectingFounder.createdAt
            )}
            isSelf={inspectingIsSelf}
            founderName={inspectingFounder.name || inspectingFounder.username}
            onClose={() => setInspectingFounder(null)}
          />
        )}
      </div>
    </MainLayoutShell>
  );
}
