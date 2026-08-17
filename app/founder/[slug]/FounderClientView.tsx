"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import MainLayoutShell from "@/app/MainLayoutShell";
import { slugify, getStoredSession, UserSession } from "@/app/data";
import VerifiedRevenueChart from "@/app/components/VerifiedRevenueChart";
import type { SuggestedFounder } from "@/lib/queries/user";
import {
  getFounderScore,
  FounderLevelBreakdownModal,
} from "@/app/components/FounderLevelBadge";

export type ViewFounder = {
  id: string;
  username: string;
  name: string;
  handle: string;
  title?: string;
  bio: string;
  image: string | null;
  website: string;
  twitter: string;
  github: string;
  revenue: string;
  mrrCents?: number;
  totalRevenueCents?: number;
  revenueProvider?: string;
  totalVotes: number;
  productsCount?: number;
  joinedAt: string;
  products: Array<{
    id: string;
    slug: string;
    name: string;
    tagline: string;
    votes: number;
    launchedAt: string;
    revenue?: string;
    category?: string;
    logoUrl?: string | null;
    websiteUrl?: string | null;
    tags?: string[];
    commentCount?: number;
  }>;
};

interface FounderProductItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  logoUrl?: string | null;
  votes: number;
  launchedAt: string;
  revenue?: string;
  awards?: { label: string; style: string }[];
}

function FounderAvatar({
  src,
  name,
  className = "w-full h-full object-cover",
  fallbackClassName = "font-mono font-bold text-ink",
}: {
  src?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [error, setError] = useState(false);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || name.slice(0, 2).toUpperCase();

  if (!src || error) {
    return <span className={fallbackClassName}>{initials}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setError(true)}
    />
  );
}

export function FounderProfileContent({
  founder,
  suggestedFounders,
  onExitPreview,
}: {
  founder: ViewFounder;
  suggestedFounders?: SuggestedFounder[];
  onExitPreview?: () => void;
}) {
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const foundersScrollRef = useRef<HTMLDivElement>(null);

  const scrollFounders = (direction: "left" | "right") => {
    if (!foundersScrollRef.current) return;
    const scrollAmount = direction === "left" ? -320 : 320;
    foundersScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  useEffect(() => {
    setUserSession(getStoredSession());
    const handleAuthChange = (e: Event) => {
      const customEv = e as CustomEvent<UserSession | null>;
      setUserSession(customEv.detail !== undefined ? customEv.detail : getStoredSession());
    };
    window.addEventListener("authChanged", handleAuthChange);
    return () => window.removeEventListener("authChanged", handleAuthChange);
  }, []);

  const isSelf = useMemo(() => {
    if (!userSession) return false;
    if (founder.id && userSession.id && userSession.id === founder.id) return true;
    const sessionHandle = (userSession.handle || "").toLowerCase().replace(/^@/, "").trim();
    const founderHandle = (founder.username || founder.handle || "").toLowerCase().replace(/^@/, "").trim();
    return !!(sessionHandle && founderHandle && sessionHandle === founderHandle);
  }, [userSession, founder.id, founder.username, founder.handle]);

  const displayProducts: FounderProductItem[] = founder.products.length
    ? founder.products.map((p) => ({
        id: p.id,
        slug: p.slug || slugify(p.name),
        name: p.name,
        tagline: p.tagline,
        category: p.category || "",
        logoUrl: p.logoUrl,
        votes: p.votes,
        launchedAt: p.launchedAt,
        revenue: p.revenue || "",
        awards: (p as any).awards || [],
      }))
    : [];

  const scoreInfo = getFounderScore(
    founder.productsCount ?? founder.products.length ?? 0,
    founder.totalVotes ?? 0,
    founder.joinedAt
  );

  return (
    <div className="space-y-5 sm:space-y-6 pb-12 w-full max-w-full overflow-hidden">
      {/* Navigation Breadcrumb Bar — Sticky & Aligned with Sidebars */}
      {!onExitPreview && (
        <div className="sticky -top-4 z-20 bg-void -mt-4 pt-4 border-b border-hairline shrink-0">
          <div className="h-10 flex items-end justify-between pb-2.5 gap-2">
            <Link
              href="/"
              className="text-xs font-mono text-ink-dim hover:text-ink flex items-center gap-1.5 transition-colors shrink-0"
            >
              ← Back to Launch Feed
            </Link>

            {/* Verified-MRR badge or Founder Index indicator */}
            {founder.revenue && founder.revenue !== "$0" && founder.revenue !== "$0 / mo" ? (
              <span className="text-[10px] font-mono px-2.5 py-1 border border-hairline bg-surface text-ink uppercase font-medium flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-signal shrink-0" />
                Verified Founder MRR {founder.revenue}
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 border border-hairline text-ink-faint uppercase shrink-0">
                FOUNDER INDEX
              </span>
            )}
          </div>
        </div>
      )}

      {/* Founder Hero Profile Card */}
      <div className="border border-hairline bg-surface/30 p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-surface border border-hairline shrink-0 rounded-xs flex items-center justify-center font-mono text-lg sm:text-xl font-bold text-ink overflow-hidden">
              <FounderAvatar
                src={founder.image}
                name={founder.name}
                className="w-full h-full object-cover"
                fallbackClassName="font-mono text-lg sm:text-xl font-bold text-ink"
              />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <h1 className="font-mono text-lg sm:text-2xl font-bold text-ink break-words">
                  {founder.name}
                </h1>
                <span className="text-[11px] font-mono px-2 py-0.5 border border-hairline text-ink-dim shrink-0">
                  {founder.handle}
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 border border-signal/40 text-signal bg-void uppercase font-bold inline-flex items-center gap-1 shrink-0">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 1L14.7 3.5H18.3L19.1 7.1L22 9.3L20.8 12.8L22 16.3L19.1 18.5L18.3 22.1H14.7L12 24.6L9.3 22.1H5.7L4.9 18.5L2 16.3L3.2 12.8L2 9.3L4.9 7.1L5.7 3.5H9.3L12 1Z" fill="currentColor"/>
                    <path d="M8.5 12.5L11 15L16 9.5" stroke="var(--color-void)" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" fill="none"/>
                  </svg>
                  VERIFIED MAKER
                </span>
              </div>

              {founder.title && (
                <p className="font-mono text-xs font-semibold text-signal break-words">
                  {founder.title}
                </p>
              )}
            </div>
          </div>

          {/* Social Profiles */}
          {(founder.twitter || founder.github || founder.website) && (
            <div className="flex items-center gap-2 flex-wrap shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-hairline/60">
              {founder.twitter && (
                <a
                  href={
                    /^https?:\/\//i.test(founder.twitter)
                      ? founder.twitter
                      : `https://twitter.com/${founder.twitter.replace(/^@/, "")}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 border border-hairline bg-surface hover:bg-raised text-ink font-mono text-[11px] font-bold transition-colors flex items-center gap-1.5"
                >
                  Twitter / X ↗
                </a>
              )}
              {founder.github && (
                <a
                  href={
                    /^https?:\/\//i.test(founder.github)
                      ? founder.github
                      : `https://github.com/${founder.github.replace(/^@/, "")}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 border border-hairline bg-surface hover:bg-raised text-ink font-mono text-[11px] font-bold transition-colors flex items-center gap-1.5"
                >
                  GitHub ↗
                </a>
              )}
              {founder.website && (
                <a
                  href={founder.website}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 border border-hairline bg-surface hover:bg-raised text-ink font-mono text-[11px] font-bold transition-colors flex items-center gap-1.5"
                >
                  Website ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Founder Stats Grid — Responsive 3 Standard Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Box 1: Products Launched */}
        <div className="border border-hairline bg-surface/20 p-3.5 sm:p-4 flex flex-row sm:flex-col items-center sm:items-start justify-between">
          <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider font-bold">
            Products Launched
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-ink whitespace-nowrap">
            {founder.productsCount ?? founder.products.length ?? 0}
          </div>
        </div>

        {/* Box 2: Community Upvotes */}
        <div className="border border-hairline bg-surface/20 p-3.5 sm:p-4 flex flex-row sm:flex-col items-center sm:items-start justify-between">
          <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider font-bold">
            Community Upvotes
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-ink whitespace-nowrap">
            {founder.totalVotes.toLocaleString()}
          </div>
        </div>

        {/* Box 3: Founder Level & Custom SVG Emblem */}
        <div
          onClick={() => setShowLevelModal(true)}
          className={`border ${scoreInfo.currentLevel.borderStyle} ${scoreInfo.currentLevel.bgStyle} p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer hover:border-signal/80 transition-all group select-none relative overflow-hidden`}
          title="Click to view Founder Reputation Specs & Progression Matrix"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-signal shrink-0" />
                <span>Founder Tier</span>
              </div>
              <div className={`text-sm sm:text-base font-mono font-bold ${scoreInfo.currentLevel.textStyle} truncate flex items-center gap-1.5 pt-0.5`}>
                <span className="truncate">{scoreInfo.currentLevel.title}</span>
              </div>
            </div>

            <div className={`w-9 h-9 border ${scoreInfo.currentLevel.borderStyle} bg-void/90 flex items-center justify-center ${scoreInfo.currentLevel.textStyle} shrink-0 group-hover:scale-105 transition-transform`}>
              <scoreInfo.currentLevel.IconComponent className="w-5 h-5" />
            </div>
          </div>

          <div className="pt-2.5 mt-2 border-t border-hairline/60 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-ink font-bold">{scoreInfo.points} PTS</span>
              <span className="text-ink-faint group-hover:text-signal transition-colors flex items-center gap-1">
                <span>Matrix Specs</span>
                <span className="group-hover:translate-x-0.5 transition-transform">↗</span>
              </span>
            </div>
            {scoreInfo.nextLevel && (
              <div className="w-full h-1 bg-void border border-hairline overflow-hidden">
                <div
                  className="h-full bg-signal transition-all duration-300"
                  style={{ width: `${scoreInfo.progressPercent}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {founder.revenue && founder.revenue !== "$0" && founder.revenue !== "$0 / mo" && (
          <div className="border border-signal/40 bg-void p-3.5 sm:p-4 col-span-1 sm:col-span-3">
            <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider font-bold">
              Verified Revenue
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold mt-1 text-signal whitespace-nowrap">
              {founder.revenue}
            </div>
          </div>
        )}
      </div>

      {/* Founder Level Matrix Modal */}
      {showLevelModal && (
        <FounderLevelBreakdownModal
          scoreInfo={scoreInfo}
          isSelf={isSelf}
          founderName={founder.name || founder.username}
          onClose={() => setShowLevelModal(false)}
        />
      )}

      {/* Verified Monthly Revenue Line Chart (Visible ONLY if user has verified revenue) */}
      {founder.revenue && founder.revenue !== "$0" && founder.revenue !== "$0 / mo" && (
        <VerifiedRevenueChart
          revenueFormatted={founder.revenue}
          mrrCents={founder.mrrCents}
          totalRevenueCents={founder.totalRevenueCents}
          providerName={founder.revenueProvider || "Stripe"}
        />
      )}

      {/* About Founder — Dedicated Section for Maker Bio */}
      <div className="border border-hairline bg-surface/20 p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="border-b border-hairline pb-2.5 sm:pb-3 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-mono text-xs sm:text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal shrink-0" />
            <span>About {founder.name}</span>
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 border border-hairline bg-void text-ink-dim uppercase font-bold shrink-0">
            Founder Story &amp; Bio
          </span>
        </div>
        <div className="space-y-3 font-mono text-xs sm:text-sm text-ink-dim leading-relaxed">
          {founder.bio ? (
            <p className="whitespace-pre-wrap break-words">{founder.bio}</p>
          ) : (
            <p className="text-ink-faint italic">
              No bio yet — this maker hasn&apos;t written an introduction.
            </p>
          )}
        </div>
      </div>

      {/* Products Portfolio Listed WITH Awards Product-Wise */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-hairline pb-2 gap-1.5 sm:gap-2">
          <h2 className="font-mono text-xs sm:text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2 flex-wrap">
            <span>Launches &amp; Earned Awards</span>
            <span className="text-xs font-mono text-ink-faint font-normal">
              ({displayProducts.length} Products)
            </span>
          </h2>
          <span className="text-[10px] sm:text-xs font-mono text-signal font-bold">
            SORTED BY REVENUE &amp; RANK
          </span>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {displayProducts.map((prod, i) => {
            const productAwards = prod.awards ?? [];

            return (
              <Link
                key={i}
                href={`/product/${prod.slug}`}
                className="p-3.5 sm:p-5 border border-hairline bg-surface/30 hover:bg-surface transition-colors group block space-y-3 sm:space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-surface border border-hairline rounded-sm flex items-center justify-center font-mono text-xs sm:text-sm font-bold text-ink shrink-0 overflow-hidden">
                      {prod.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={prod.logoUrl} alt={prod.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        prod.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-mono text-sm sm:text-base font-bold text-ink group-hover:text-signal transition-colors flex items-center gap-2 flex-wrap">
                        <span className="break-words">{prod.name}</span>
                        {prod.category && (
                          <span className="text-[9px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.5 border border-hairline text-ink-dim uppercase shrink-0">
                            {prod.category}
                          </span>
                        )}
                      </h3>
                      <p className="font-mono text-xs text-ink-dim mt-0.5 break-words line-clamp-2 sm:line-clamp-none">
                        {prod.tagline}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline/40">
                    {prod.revenue && (
                      <span className="text-[9px] sm:text-[10px] font-mono px-2 sm:px-2.5 py-1 border border-hairline bg-surface text-ink uppercase font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-signal shrink-0" />
                        {prod.revenue}
                      </span>
                    )}
                    <div className="px-3 sm:px-3.5 py-1 sm:py-1.5 border border-hairline bg-void font-mono text-xs text-ink font-bold">
                      ▲ {prod.votes.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Product-Wise Earned Awards Strip */}
                {productAwards.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-hairline/60">
                    <div className="text-[10px] font-mono text-ink-faint uppercase font-bold">
                      Product Recognition &amp; Trophy List:
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {productAwards.map(
                        (
                          award: { label: string; style: string },
                          aIdx: number
                        ) => (
                          <span
                            key={aIdx}
                            className={`text-[9px] sm:text-[10px] font-mono px-2 sm:px-2.5 py-0.5 border font-bold ${award.style}`}
                          >
                            {award.label}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Founder Milestone Timeline */}
      {displayProducts.length > 0 && (
        <div className="border border-hairline bg-surface/20 p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-4 font-mono text-xs">
          <h2 className="font-bold text-ink uppercase tracking-wider border-b border-hairline pb-2">
            Launch History
          </h2>
          <div className="space-y-3">
            {displayProducts.map((prod, i) => (
              <div
                key={prod.id}
                className={`flex items-start gap-3 sm:gap-4 border-l-2 pl-3 sm:pl-4 py-1 ${
                  i === 0 ? "border-l-signal" : "border-l-hairline"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span
                    className={`font-bold text-xs ${i === 0 ? "text-signal" : "text-ink-dim"}`}
                  >
                    {new Date(prod.launchedAt)
                      .toLocaleString("en-US", { month: "short", year: "numeric" })
                      .toUpperCase()}
                  </span>
                  <p className="text-ink font-medium mt-0.5 break-words">Launched {prod.name}</p>
                  <p className="text-ink-dim text-[11px] mt-0.5 break-words">
                    {prod.votes.toLocaleString()} upvotes to date · {prod.tagline}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Similar / Suggested Founders Carousel */}
      {suggestedFounders && suggestedFounders.length > 0 && (
        <div className="space-y-3 sm:space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-hairline pb-2">
            <h2 className="font-mono text-xs sm:text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-signal" />
              <span>Explore More Founders &amp; Makers</span>
              <span className="text-[10px] font-mono text-ink-faint font-normal">
                ({suggestedFounders.length} Active)
              </span>
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollFounders("left")}
                aria-label="Scroll left"
                className="w-7 h-7 border border-hairline bg-void hover:bg-surface text-ink flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollFounders("right")}
                aria-label="Scroll right"
                className="w-7 h-7 border border-hairline bg-void hover:bg-surface text-ink flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
              >
                →
              </button>
            </div>
          </div>

          {/* Horizontal Scroll Carousel */}
          <div
            ref={foundersScrollRef}
            className="flex items-stretch gap-3.5 overflow-x-auto no-scrollbar scroll-smooth py-1 -mx-1 px-1"
          >
            {suggestedFounders.map((sf) => {
              const displayName = sf.name || sf.username;
              const handle = `@${sf.username}`;
              const initials = displayName.substring(0, 2).toUpperCase();

              return (
                <Link
                  key={sf.id}
                  href={`/founder/${sf.username}`}
                  className="w-[260px] sm:w-[290px] shrink-0 border border-hairline bg-surface/30 hover:border-signal/70 hover:bg-surface/60 transition-all p-4 flex flex-col justify-between group space-y-3.5 snap-start"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 bg-surface border border-hairline rounded-sm flex items-center justify-center font-mono font-bold text-xs text-ink shrink-0 overflow-hidden relative">
                        <FounderAvatar
                          src={sf.image}
                          name={displayName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          fallbackClassName="font-mono font-bold text-xs text-ink-dim"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-mono text-xs sm:text-sm font-bold text-ink group-hover:text-signal transition-colors truncate">
                          {displayName}
                        </h3>
                        <p className="font-mono text-[11px] text-ink-dim truncate">
                          {handle}
                        </p>
                      </div>
                    </div>

                    {sf.title && (
                      <p className="font-mono text-[11px] text-ink-dim line-clamp-1 leading-tight font-medium">
                        {sf.title}
                      </p>
                    )}

                    {sf.bio && (
                      <p className="font-sans text-[11px] text-ink-dim line-clamp-2 leading-relaxed">
                        {sf.bio}
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-hairline/60 flex items-center justify-between gap-2 text-[10px] font-mono">
                    {sf.featuredProductName ? (
                      <span className="text-ink-faint truncate max-w-[150px]">
                        Maker of <strong className="text-ink">{sf.featuredProductName}</strong>
                      </span>
                    ) : (
                      <span className="text-ink-faint">
                        {sf.productsCount} {sf.productsCount === 1 ? "Product" : "Products"} Launched
                      </span>
                    )}
                    <span className="text-signal font-bold group-hover:translate-x-0.5 transition-transform shrink-0">
                      Profile →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FounderClientView({
  slug,
  founder,
  suggestedFounders,
}: {
  slug: string;
  founder: ViewFounder;
  suggestedFounders?: SuggestedFounder[];
}) {
  useEffect(() => {
    document.title = `${founder.name} (${founder.handle}) — Founder Profile | The Launch Feed`;
  }, [founder]);

  return (
    <MainLayoutShell>
      <FounderProfileContent founder={founder} suggestedFounders={suggestedFounders} />
    </MainLayoutShell>
  );
}
