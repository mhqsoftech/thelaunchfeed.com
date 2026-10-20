"use client";

import { withLaunchTime } from "@/components/ui/withLaunchTime";
import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, getWeek } from "date-fns";
import MainLayoutShell from "@/app/MainLayoutShell";
import { slugify, getStoredSession } from "@/app/data";
import { toggleVote } from "@/app/actions/interactions";
import type { BoardRow } from "@/app/api/board/route";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { HomeEditorialSection, type LiveTopProductItem } from "@/components/home/HomeEditorialSection";
import { NextLaunchCountdown } from "@/components/ui/NextLaunchCountdown";
import { getDailyCycleRange } from "@/lib/schedule";
import {
  isProductUpvoted,
  optimisticToggle,
  readSessionFromCache,
  writeSessionToCache,
} from "@/components/ui/interaction-cache";

export type FeedTab = "daily" | "weekly" | "monthly" | "yearly" | "alltime";

/** Every board has its own crawlable URL (see app/leaderboard/[period]). */
export const TAB_PATHS: Record<FeedTab, string> = {
  daily: "/",
  weekly: "/leaderboard/weekly",
  monthly: "/leaderboard/monthly",
  yearly: "/leaderboard/yearly",
  alltime: "/leaderboard/all-time",
};

const TABS: FeedTab[] = ["daily", "weekly", "monthly", "yearly", "alltime"];

function UpvoteButton({ productId, voteCount, emphasis = false }: { productId: string; voteCount: number; emphasis?: boolean }) {
  const router = useRouter();
  const [voted, setVoted] = useState(false);
  const [currentVotes, setCurrentVotes] = useState(voteCount);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setVoted(isProductUpvoted(productId));
    setCurrentVotes(voteCount);
  }, [productId, voteCount]);

  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const session = getStoredSession();
    if (!session) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const optimistic = optimisticToggle(productId, "upvotedProductIds");
    setVoted(optimistic);
    setCurrentVotes((prev) => (optimistic ? prev + 1 : prev - 1));
    if (optimistic) {
      setPulse(true);
      setTimeout(() => setPulse(false), 450);
    }
    try {
      const res = await toggleVote(productId);
      setVoted(res.voted);
      setCurrentVotes(res.voteCount);
      const s = readSessionFromCache() || {};
      const list = (s.upvotedProductIds ?? []).filter((x: string) => x !== productId);
      if (res.voted) list.push(productId);
      writeSessionToCache({ ...s, upvotedProductIds: list });
    } catch (err) {
      optimisticToggle(productId, "upvotedProductIds");
      setVoted(!optimistic);
      setCurrentVotes((prev) => (optimistic ? prev - 1 : prev + 1));
      console.error("[vote] failed:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleUpvote}
      aria-pressed={voted}
      aria-label={`${voted ? "Remove upvote" : "Upvote"} (${currentVotes} votes)`}
      className={`relative z-10 shrink-0 w-14 h-14 sm:w-16 sm:h-16 flex flex-col items-center justify-center gap-0.5 rounded-xl border transition-all active:scale-95 ${
        voted
          ? "border-signal bg-signal text-white shadow-[0_8px_20px_-10px_var(--color-signal)]"
          : emphasis
          ? "border-signal/40 bg-signal-dim text-signal hover:border-signal"
          : "border-hairline bg-card text-ink hover:border-signal hover:text-signal"
      } ${pulse ? "scale-110" : ""}`}
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={voted ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
        <path strokeLinejoin="round" d="M12 5.5 20 18H4z" />
      </svg>
      <span className="text-[13px] font-mono font-bold leading-none tabular-nums">{currentVotes}</span>
    </button>
  );
}

function ProductLogo({ src, name, size = 56, eager = false }: { src?: string | null; name: string; size?: number; eager?: boolean }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface flex items-center justify-center font-mono text-xs font-bold text-ink-dim"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} logo`}
          width={size}
          height={size}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          className="w-full h-full object-cover"
        />
      ) : (
        name.substring(0, 2).toUpperCase()
      )}
    </div>
  );
}

const RANK_LABEL: Record<FeedTab, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
  yearly: String(new Date().getFullYear()),
  alltime: "all-time",
};

function ProductRow({
  prod,
  rank,
  tab,
  categoryHref,
}: {
  prod: BoardRow;
  rank: number;
  tab: FeedTab;
  categoryHref: string;
}) {
  const podium = rank <= 3;
  const href = `/product/${prod.slug || slugify(prod.name)}`;
  return (
    <li
      className={`group relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-[var(--radius-card)] border bg-card transition-all hover:-translate-y-px hover:shadow-[var(--shadow-lift)] ${
        rank === 1 ? "border-signal/40" : "border-hairline hover:border-ink-faint"
      }`}
    >
      {rank === 1 && <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r bg-signal" aria-hidden />}
      <span
        className={`hidden sm:block w-9 text-center font-display font-black text-2xl leading-none tabular-nums ${
          rank === 1 ? "text-signal" : podium ? "text-ink" : "text-ink-faint"
        }`}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>

      <ProductLogo src={prod.logoUrl} name={prod.name} eager={rank <= 3} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`sm:hidden font-mono text-xs font-bold ${rank === 1 ? "text-signal" : "text-ink-faint"}`}>#{rank}</span>
          <h3 className="text-[15px] sm:text-base font-semibold text-ink truncate">
            <Link href={href} prefetch={false} className="after:absolute after:inset-0 after:rounded-[var(--radius-card)] group-hover:text-signal transition-colors">
              {prod.name}
            </Link>
          </h3>
          {podium && (
            <span
              className={`hidden sm:inline-block shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                rank === 1 ? "bg-signal text-white" : "bg-surface text-ink-dim border border-hairline"
              }`}
            >
              #{rank} {RANK_LABEL[tab]}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-ink-dim line-clamp-2 sm:line-clamp-1">{prod.tagline}</p>
        <div className="mt-1.5 flex items-center gap-x-2.5 gap-y-1 flex-wrap text-xs text-ink-faint">
          <Link
            href={categoryHref}
            prefetch={false}
            className="relative z-10 px-2 py-0.5 rounded-full bg-surface text-ink-dim hover:text-signal hover:bg-signal-dim transition-colors"
          >
            {prod.category || "Tech"}
          </Link>
          <span className="truncate">by {prod.makerName}</span>
          {prod.revenue && (
            <span className="px-2 py-0.5 rounded-full bg-verified/10 text-verified font-semibold font-mono">{prod.revenue}</span>
          )}
          <span className="relative z-10">
            <BookmarkButton productId={prod.id} />
          </span>
        </div>
      </div>

      <UpvoteButton productId={prod.id} voteCount={prod.votes ?? prod.voteCount ?? 0} emphasis={rank === 1} />
    </li>
  );
}

export type HomeFeedInitialData = {
  products: BoardRow[];
  totalCount: number;
  totalPages: number;
};

export default function HomeFeedClient({
  initialFeed,
  initialTab = "daily",
  initialCategories,
  liveTopProducts,
  showEditorial = true,
}: {
  initialFeed?: HomeFeedInitialData;
  initialTab?: FeedTab;
  initialCategories?: { id?: string; slug: string; name: string; productCount: number }[];
  liveTopProducts?: LiveTopProductItem[];
  showEditorial?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedData, setFeedData] = useState<HomeFeedInitialData>(initialFeed ?? { products: [], totalCount: 0, totalPages: 1 });

  const tabCacheRef = useRef<Record<string, HomeFeedInitialData>>(initialFeed ? { [`${initialTab}_1`]: initialFeed } : {});
  const isInitialMount = useRef(true);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  // The board's day (cycles at 6:00 AM IST) as a plain calendar date, so the
  // server (UTC) and every visitor's timezone render the same header text.
  const [cy, cm, cd] = getDailyCycleRange().key.split("-").map(Number);
  const now = new Date(cy, cm - 1, cd);
  const year = format(now, "yyyy");
  const subtitle: Record<FeedTab, string> = {
    daily: format(now, "EEEE, d MMMM yyyy"),
    weekly: `Week ${getWeek(now)} · ${year}`,
    monthly: format(now, "MMMM yyyy"),
    yearly: year,
    alltime: "Since launch",
  };
  const headline: Record<FeedTab, string> = {
    daily: "Today's top launches",
    weekly: "Best new products this week",
    monthly: "Best new products this month",
    yearly: `Best products of ${year}`,
    alltime: "All-time hall of fame",
  };
  const tabLabel: Record<FeedTab, string> = {
    daily: "Today",
    weekly: "Week",
    monthly: "Month",
    yearly: year,
    alltime: "All time",
  };

  const loadTabProducts = useCallback(async (tab: string, page: number) => {
    const cacheKey = `${tab}_${page}`;
    const cached = tabCacheRef.current[cacheKey];
    if (cached) {
      setFeedData(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/board?tab=${tab}&page=${page}&limit=50`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      const next: HomeFeedInitialData = {
        products: data.products ?? [],
        totalCount: data.totalCount ?? 0,
        totalPages: data.totalPages ?? 1,
      };
      tabCacheRef.current[cacheKey] = next;
      setFeedData(next);
    } catch (err) {
      console.error("Failed to fetch board tab products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialFeed && activeTab === initialTab) return;
    }
    loadTabProducts(activeTab, currentPage);
  }, [activeTab, currentPage, initialFeed, initialTab, loadTabProducts]);

  // Legacy ?tab= links keep working.
  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam && (TABS as string[]).includes(tabParam) && tabParam !== initialTab) {
      setActiveTab(tabParam as FeedTab);
    }
  }, [initialTab]);

  // Browser back/forward between boards.
  useEffect(() => {
    const onPop = () => {
      const match = (Object.entries(TAB_PATHS) as [FeedTab, string][]).find(([, p]) => p === window.location.pathname);
      if (match) {
        setActiveTab(match[0]);
        setCurrentPage(1);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleTabChange = (tab: FeedTab, e?: React.MouseEvent) => {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return; // let new-tab clicks through
    e?.preventDefault();
    const cached = tabCacheRef.current[`${tab}_1`];
    if (cached) {
      setFeedData(cached);
      setLoading(false);
    }
    startTransition(() => {
      setActiveTab(tab);
      setCurrentPage(1);
      window.history.pushState({}, "", TAB_PATHS[tab]);
    });
  };

  const categoryHrefFor = (name: string) => {
    const matched = initialCategories?.find((c) => c.name.toLowerCase() === name.toLowerCase() || c.slug === slugify(name));
    return `/category/${matched?.slug || slugify(name || "tech")}`;
  };

  const products = feedData.products;
  const grouped = activeTab === "weekly" || activeTab === "monthly";
  const categoryGroups = (() => {
    if (!grouped) return [];
    const map = new Map<string, BoardRow[]>();
    products.forEach((p) => {
      const cat = p.category?.trim() || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    return Array.from(map.entries())
      .map(([name, prods]) => ({
        name,
        href: categoryHrefFor(name),
        total: prods.length,
        top: [...prods].sort((a, b) => (b.votes ?? b.voteCount ?? 0) - (a.votes ?? a.voteCount ?? 0)).slice(0, 5),
      }))
      .sort((a, b) => (b.top[0]?.votes ?? 0) - (a.top[0]?.votes ?? 0));
  })();

  return (
    <MainLayoutShell>
      <div className="space-y-6" ref={feedContainerRef}>
        {/* Board header */}
        <header className="relative overflow-hidden rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card px-5 py-5 sm:px-7 sm:py-6">
          <div className="tlf-signal-grid absolute inset-0 pointer-events-none" aria-hidden />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-ink-faint">
                {activeTab === "daily" && <span className="tlf-live-dot w-1.5 h-1.5 rounded-full bg-signal-bright" aria-hidden />}
                {subtitle[activeTab]}
              </p>
              <h1 className="mt-1.5 font-display font-black uppercase tracking-wide text-[26px] sm:text-[34px] leading-[1.05] text-ink">
                {headline[activeTab]}
              </h1>
              <p className="mt-2 text-sm text-ink-dim max-w-xl">
                {activeTab === "daily"
                  ? withLaunchTime("New software, SaaS and AI products go live every day at 6:00 AM IST. Upvote the ones you'd actually use.", { showIst: true })
                  : activeTab === "alltime"
                  ? "The most upvoted products ever launched on The Launch Feed."
                  : `The highest-voted launches ${activeTab === "yearly" ? `of ${year}` : `this ${activeTab === "weekly" ? "week" : "month"}`}, grouped by category.`}
              </p>
              {activeTab === "daily" && <NextLaunchCountdown variant="compact" className="mt-3" />}
            </div>
            <nav aria-label="Leaderboard timeframe" className="shrink-0 -mx-1 overflow-x-auto no-scrollbar">
              <ul className="flex gap-1 p-1 rounded-full bg-surface border border-hairline w-max">
                {TABS.map((t) => (
                  <li key={t}>
                    <a
                      href={TAB_PATHS[t]}
                      onClick={(e) => handleTabChange(t, e)}
                      aria-current={activeTab === t ? "page" : undefined}
                      className={`block px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                        activeTab === t ? "bg-card text-ink shadow-[var(--shadow-card)]" : "text-ink-dim hover:text-ink"
                      }`}
                    >
                      {tabLabel[t]}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        {loading ? (
          <ul className="space-y-2.5" aria-busy="true" aria-label="Loading products">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="h-[88px] rounded-[var(--radius-card)] border border-hairline bg-card animate-pulse" />
            ))}
          </ul>
        ) : grouped ? (
          categoryGroups.length > 0 ? (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
              {categoryGroups.map((group) => (
                <section key={group.name} aria-labelledby={`cat-${slugify(group.name)}`} className="rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card p-2 sm:p-3">
                  <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
                    <h2 id={`cat-${slugify(group.name)}`} className="text-base font-semibold text-ink">
                      {group.name}
                      <span className="ml-2 text-xs font-normal text-ink-faint">
                        {group.total} {group.total === 1 ? "launch" : "launches"}
                      </span>
                    </h2>
                    <Link href={group.href} className="shrink-0 text-xs font-semibold text-signal hover:underline">
                      View category →
                    </Link>
                  </div>
                  <ol className="space-y-1">
                    {group.top.map((prod, idx) => (
                      <li key={prod.id} className="group relative flex items-center gap-3 p-2 rounded-xl hover:bg-surface transition-colors">
                        <span className={`w-6 text-center font-display font-black text-lg ${idx === 0 ? "text-signal" : "text-ink-faint"}`}>{idx + 1}</span>
                        <ProductLogo src={prod.logoUrl} name={prod.name} size={44} />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-semibold text-ink truncate">
                            <Link
                              href={`/product/${prod.slug || slugify(prod.name)}`}
                              prefetch={false}
                              className="after:absolute after:inset-0 after:rounded-xl group-hover:text-signal transition-colors"
                            >
                              {prod.name}
                            </Link>
                          </h3>
                          <p className="text-[13px] text-ink-dim truncate">{prod.tagline}</p>
                        </div>
                        <UpvoteButton productId={prod.id} voteCount={prod.votes ?? prod.voteCount ?? 0} emphasis={idx === 0} />
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          ) : (
            <EmptyBoard tab={activeTab} onSwitch={handleTabChange} />
          )
        ) : products.length > 0 ? (
          <ol className="space-y-2.5">
            {products.map((prod, i) => (
              <ProductRow
                key={prod.id}
                prod={prod}
                rank={(currentPage - 1) * 50 + i + 1}
                tab={activeTab}
                categoryHref={categoryHrefFor(prod.category)}
              />
            ))}
          </ol>
        ) : (
          <EmptyBoard tab={activeTab} onSwitch={handleTabChange} />
        )}

        {feedData.totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCurrentPage((p) => Math.max(p - 1, 1));
                feedContainerRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              disabled={currentPage <= 1 || loading}
              className="h-10 px-4 rounded-full border border-hairline bg-card text-sm font-medium text-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface"
            >
              ← Previous
            </button>
            <span className="text-xs text-ink-dim tabular-nums">
              Page <strong className="text-ink">{currentPage}</strong> of {feedData.totalPages} · {feedData.totalCount} products
            </span>
            <button
              type="button"
              onClick={() => {
                setCurrentPage((p) => Math.min(p + 1, feedData.totalPages));
                feedContainerRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              disabled={currentPage >= feedData.totalPages || loading}
              className="h-10 px-4 rounded-full bg-ink text-void text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            >
              Next →
            </button>
          </nav>
        )}

        {showEditorial && <HomeEditorialSection categories={initialCategories} liveProducts={liveTopProducts} />}
      </div>
    </MainLayoutShell>
  );
}

function EmptyBoard({ tab, onSwitch }: { tab: FeedTab; onSwitch: (t: FeedTab, e?: React.MouseEvent) => void }) {
  return (
    <div className="rounded-[calc(var(--radius-card)+4px)] border border-dashed border-hairline bg-card px-6 py-14 text-center">
      <p className="font-display font-black uppercase text-xl text-ink">
        {tab === "daily" ? "Today's board is warming up" : "Nothing ranked here yet"}
      </p>
      <p className="mt-2 text-sm text-ink-dim max-w-md mx-auto">
        {tab === "daily"
          ? withLaunchTime("The next batch of launches goes live at 6:00 AM IST. Get your product in the queue — launching is free.")
          : "Launches appear here as soon as they collect votes."}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link href="/submit" className="inline-flex items-center h-10 px-5 rounded-full bg-signal text-white text-sm font-semibold hover:brightness-110">
          Launch your product
        </Link>
        {tab !== "weekly" && (
          <a
            href={TAB_PATHS.weekly}
            onClick={(e) => onSwitch("weekly", e)}
            className="inline-flex items-center h-10 px-5 rounded-full border border-hairline text-sm font-medium text-ink hover:bg-surface"
          >
            See this week&apos;s best
          </a>
        )}
      </div>
    </div>
  );
}
