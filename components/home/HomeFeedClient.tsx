"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, getWeek } from "date-fns";
import MainLayoutShell from "@/app/MainLayoutShell";
import { slugify, getStoredSession } from "@/app/data";
import { toggleVote } from "@/app/actions/interactions";
import type { BoardRow } from "@/app/api/board/route";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { LaunchFeedLoader } from "@/components/ui/LaunchFeedLoader";
import {
  HomeEditorialSection,
  type LiveTopProductItem,
} from "@/components/home/HomeEditorialSection";
import {
  isProductUpvoted,
  optimisticToggle,
  readSessionFromCache,
  writeSessionToCache,
} from "@/components/ui/interaction-cache";

function UpvoteButton({
  productId,
  voteCount,
  upvoteClass,
}: {
  productId: string;
  voteCount: number;
  upvoteClass: string;
}) {
  const router = useRouter();
  const [voted, setVoted] = useState(false);
  const [currentVotes, setCurrentVotes] = useState(voteCount);

  useEffect(() => {
    setVoted(isProductUpvoted(productId));
    setCurrentVotes(voteCount);
  }, [productId, voteCount]);

  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const session = getStoredSession();
    if (!session) {
      router.push(`/login?redirect=${encodeURIComponent("/")}`);
      return;
    }
    const optimistic = optimisticToggle(productId, "upvotedProductIds");
    setVoted(optimistic);
    setCurrentVotes((prev) => (optimistic ? prev + 1 : prev - 1));
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
      className={`w-14 h-14 shrink-0 flex flex-col items-center justify-center border transition-colors cursor-pointer ${
        voted ? "border-signal bg-signal text-void font-bold" : upvoteClass
      }`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="square" strokeLinejoin="miter" d="M5 15l7-7 7 7" />
      </svg>
      <span className="text-xs font-mono mt-0.5 leading-none font-bold">
        {currentVotes}
      </span>
    </button>
  );
}

// Emblems for Top 3 rankings
function HallOfFameTrophy({ className = "w-4 h-4 text-signal inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <path d="M6 3h12v4c0 3.3-2.7 6-6 6s-6-2.7-6-6V3z" fill="currentColor" fillOpacity="0.15" />
      <path d="M6 3H3v4c0 1.7 1.3 3 3 3M18 3h3v4c0 1.7-1.3 3-3 3" />
      <path d="M12 13v4M8 21h8M10 17h4" />
      <polygon points="12,5 13,7.5 15.5,7.5 13.5,9 14.5,11.5 12,10 9.5,11.5 10.5,9 8.5,7.5 11,7.5" fill="currentColor" />
    </svg>
  );
}

function GrandMasterShield({ className = "w-4 h-4 text-ink inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <polygon points="12,2 21,6 21,14 12,22 3,14 3,6" fill="currentColor" fillOpacity="0.1" />
      <path d="M12 6l-3 4h6l-3 4" />
      <circle cx="7" cy="9" r="1" fill="currentColor" />
      <circle cx="17" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}

function LegendaryLaurel({ className = "w-4 h-4 text-ink-dim inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9z" strokeDasharray="3 2" />
      <polygon points="12,7 13.5,10.5 17,10.5 14,13 15.5,16.5 12,14 8.5,16.5 10,13 7,10.5 10.5,10.5" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

function YearlyChampionCrown({ className = "w-4 h-4 text-ink inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <path d="M3 17l2-11 4.5 5 2.5-7 2.5 7 4.5-5 2 11H3z" fill="currentColor" fillOpacity="0.2" />
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="5" cy="6" r="1" fill="currentColor" />
      <circle cx="19" cy="6" r="1" fill="currentColor" />
    </svg>
  );
}

function YearlySilverCrest({ className = "w-4 h-4 text-ink-dim inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <polygon points="12,3 20,12 12,21 4,12" fill="currentColor" fillOpacity="0.15" />
      <polygon points="12,7 16,12 12,17 8,12" />
    </svg>
  );
}

function YearlyBronzeMedal({ className = "w-4 h-4 text-ink-faint inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <circle cx="12" cy="13" r="7" />
      <path d="M9 2h6l2 5H7l2-5z" />
      <polygon points="12,10 13,12 15,12 13.5,13.5 14,15.5 12,14 10,15.5 10.5,13.5 9,12 11,12" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function MonthlyStarCrest({ className = "w-4 h-4 text-ink inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

function MonthlySilverRibbon({ className = "w-4 h-4 text-ink-dim inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <circle cx="12" cy="9" r="6" />
      <path d="M8 14l-2 7 6-3 6 3-2-7" />
    </svg>
  );
}

function MonthlyBronzePill({ className = "w-4 h-4 text-ink-faint inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <polygon points="12,3 19,7 19,17 12,21 5,17 5,7" opacity="0.8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function WeeklyLightningBolt({ className = "w-4 h-4 text-ink-dim inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <polygon points="13,2 4,14 11,14 9,22 18,10 11,10" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

function WeeklySilverChevron({ className = "w-4 h-4 text-ink-faint inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <path d="M6 7l6 6 6-6M6 13l6 6 6-6" />
    </svg>
  );
}

function WeeklyBronzeDot({ className = "w-4 h-4 text-ink-faint inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function DailySunburst({ className = "w-4 h-4 text-signal inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M4.9 19.1l2.2-2.2M16.9 7.1l2.2-2.2" />
    </svg>
  );
}

function DailySilverSpark({ className = "w-4 h-4 text-ink-dim inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <path d="M12 3v18M3 12h18" strokeDasharray="2 2" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function DailyBronzeLeaf({ className = "w-4 h-4 text-ink-faint inline shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <path d="M12 4v16M8 8l4 4 4-4" />
    </svg>
  );
}

function getTop3Styles(rank: number, tab: "daily" | "weekly" | "monthly" | "yearly" | "alltime") {
  if (rank > 3) {
    return {
      cardClass: "border-b border-hairline group hover:bg-surface transition-colors",
      badge: null,
      numberClass: "text-ink-faint",
      upvoteClass: "border-hairline text-ink-dim hover:border-ink-faint group-hover:bg-void",
    };
  }

  if (tab === "alltime") {
    if (rank === 1) {
      return {
        cardClass: "border-b border-hairline border-l-4 border-l-signal group hover:bg-surface/80 transition-colors py-5",
        badge: (
          <span className="px-2.5 py-0.5 text-[10px] font-mono tracking-widest text-signal border border-signal bg-void uppercase shrink-0 font-bold flex items-center gap-1.5">
            <HallOfFameTrophy className="w-3.5 h-3.5 text-signal shrink-0" />
            GOAT · ALL-TIME #1
          </span>
        ),
        numberClass: "text-signal font-black text-3xl sm:text-4xl",
        upvoteClass: "border-signal text-signal font-bold bg-void hover:bg-signal hover:text-void",
      };
    } else if (rank === 2) {
      return {
        cardClass: "border-b border-hairline border-l-4 border-l-ink group hover:bg-surface/50 transition-colors py-4.5",
        badge: (
          <span className="px-2.5 py-0.5 text-[10px] font-mono tracking-widest text-ink border border-ink bg-void uppercase shrink-0 font-bold flex items-center gap-1.5">
            <GrandMasterShield className="w-3.5 h-3.5 text-ink shrink-0" />
            ALL-TIME #2
          </span>
        ),
        numberClass: "text-ink font-black text-2xl sm:text-3xl",
        upvoteClass: "border-ink text-ink font-bold bg-void hover:bg-ink hover:text-void",
      };
    } else {
      return {
        cardClass: "border-b border-hairline border-l-4 border-l-ink-dim group hover:bg-surface/35 transition-colors py-4",
        badge: (
          <span className="px-2 py-0.5 text-[10px] font-mono tracking-widest text-ink-dim border border-hairline bg-void uppercase shrink-0 font-semibold flex items-center gap-1.5">
            <LegendaryLaurel className="w-3.5 h-3.5 text-ink-dim shrink-0" />
            ALL-TIME #3
          </span>
        ),
        numberClass: "text-ink-dim font-bold text-2xl sm:text-3xl",
        upvoteClass: "border-hairline text-ink-dim bg-void",
      };
    }
  }

  if (tab === "yearly") {
    if (rank === 1) {
      return {
        cardClass: "border-b border-hairline border-l-4 border-l-ink group hover:bg-surface/70 transition-colors py-5",
        badge: (
          <span className="px-2.5 py-0.5 text-[10px] font-mono tracking-widest text-ink border border-ink bg-void uppercase shrink-0 font-bold flex items-center gap-1.5">
            <YearlyChampionCrown className="w-3.5 h-3.5 text-ink shrink-0" />
            2026 CHAMPION
          </span>
        ),
        numberClass: "text-ink font-black text-3xl sm:text-4xl",
        upvoteClass: "border-ink text-ink font-bold bg-void hover:bg-ink hover:text-void",
      };
    } else if (rank === 2) {
      return {
        cardClass: "border-b border-hairline border-l-2 border-l-ink-dim group hover:bg-surface/45 transition-colors py-4.5",
        badge: (
          <span className="px-2 py-0.5 text-[10px] font-mono tracking-wider text-ink-dim border border-hairline bg-void uppercase shrink-0 font-semibold flex items-center gap-1.5">
            <YearlySilverCrest className="w-3.5 h-3.5 text-ink-dim shrink-0" />
            2026 #2
          </span>
        ),
        numberClass: "text-ink-dim font-bold text-2xl sm:text-3xl",
        upvoteClass: "border-hairline text-ink-dim bg-void",
      };
    } else {
      return {
        cardClass: "border-b border-hairline border-l-2 border-l-hairline group hover:bg-surface/30 transition-colors py-4",
        badge: (
          <span className="px-2 py-0.5 text-[10px] font-mono tracking-wider text-ink-faint border border-hairline bg-void uppercase shrink-0 flex items-center gap-1.5">
            <YearlyBronzeMedal className="w-3.5 h-3.5 text-ink-faint shrink-0" />
            2026 #3
          </span>
        ),
        numberClass: "text-ink-faint font-medium text-2xl sm:text-3xl",
        upvoteClass: "border-hairline text-ink-faint bg-void",
      };
    }
  }

  if (tab === "monthly") {
    if (rank === 1) {
      return {
        cardClass: "border-b border-hairline border-l-2 border-l-ink group hover:bg-surface/60 transition-colors py-4.5",
        badge: (
          <span className="px-2.5 py-0.5 text-[10px] font-mono tracking-wider text-ink border border-ink bg-void uppercase shrink-0 font-bold flex items-center gap-1.5">
            <MonthlyStarCrest className="w-3.5 h-3.5 text-ink shrink-0" />
            MONTHLY #1
          </span>
        ),
        numberClass: "text-ink font-bold text-2xl sm:text-3xl",
        upvoteClass: "border-ink text-ink font-semibold bg-void",
      };
    } else if (rank === 2) {
      return {
        cardClass: "border-b border-hairline group hover:bg-surface/35 transition-colors py-4",
        badge: (
          <span className="px-2 py-0.5 text-[10px] font-mono text-ink-dim border border-hairline bg-void uppercase shrink-0 flex items-center gap-1.5">
            <MonthlySilverRibbon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
            MONTHLY #2
          </span>
        ),
        numberClass: "text-ink-dim text-2xl sm:text-3xl",
        upvoteClass: "border-hairline text-ink-dim bg-void",
      };
    } else {
      return {
        cardClass: "border-b border-hairline group hover:bg-surface/25 transition-colors py-4",
        badge: (
          <span className="px-2 py-0.5 text-[10px] font-mono text-ink-faint border border-hairline bg-void uppercase shrink-0 flex items-center gap-1.5">
            <MonthlyBronzePill className="w-3.5 h-3.5 text-ink-faint shrink-0" />
            MONTHLY #3
          </span>
        ),
        numberClass: "text-ink-faint text-2xl sm:text-3xl",
        upvoteClass: "border-hairline text-ink-faint bg-void",
      };
    }
  }

  if (tab === "weekly") {
    if (rank === 1) {
      return {
        cardClass: "border-b border-hairline border-l-2 border-l-ink-dim group hover:bg-surface/45 transition-colors py-4.5",
        badge: (
          <span className="px-2.5 py-0.5 text-[10px] font-mono tracking-wider text-ink-dim border border-hairline bg-void uppercase shrink-0 font-semibold flex items-center gap-1.5">
            <WeeklyLightningBolt className="w-3.5 h-3.5 text-ink-dim shrink-0" />
            WEEKLY #1 LEADER
          </span>
        ),
        numberClass: "text-ink-dim font-bold text-2xl sm:text-3xl",
        upvoteClass: "border-hairline text-ink-dim bg-void",
      };
    } else if (rank === 2) {
      return {
        cardClass: "border-b border-hairline group hover:bg-surface/30 transition-colors py-4",
        badge: (
          <span className="px-2 py-0.5 text-[10px] font-mono text-ink-faint border border-hairline bg-void uppercase shrink-0 flex items-center gap-1.5">
            <WeeklySilverChevron className="w-3.5 h-3.5 text-ink-faint shrink-0" />
            WEEKLY #2
          </span>
        ),
        numberClass: "text-ink-faint text-2xl sm:text-3xl",
        upvoteClass: "border-hairline text-ink-faint bg-void",
      };
    } else {
      return {
        cardClass: "border-b border-hairline group hover:bg-surface/20 transition-colors py-4",
        badge: (
          <span className="px-2 py-0.5 text-[10px] font-mono text-ink-faint border border-hairline bg-void uppercase shrink-0 flex items-center gap-1.5">
            <WeeklyBronzeDot className="w-3.5 h-3.5 text-ink-faint shrink-0" />
            WEEKLY #3
          </span>
        ),
        numberClass: "text-ink-faint text-2xl sm:text-3xl",
        upvoteClass: "border-hairline text-ink-faint bg-void",
      };
    }
  }

  // Daily
  if (rank === 1) {
    return {
      cardClass: "border-b border-hairline border-l-2 border-l-signal group hover:bg-surface/40 transition-colors py-4.5",
      badge: (
        <span className="px-2.5 py-0.5 text-[10px] font-mono tracking-wider text-signal border border-signal/40 bg-void uppercase shrink-0 font-medium flex items-center gap-1.5">
          <DailySunburst className="w-3.5 h-3.5 text-signal shrink-0" />
          TODAY #1 LEADER
        </span>
      ),
      numberClass: "text-signal font-bold text-2xl sm:text-3xl",
      upvoteClass: "border-hairline text-ink font-medium bg-void",
    };
  } else if (rank === 2) {
    return {
      cardClass: "border-b border-hairline group hover:bg-surface/25 transition-colors py-4",
      badge: (
        <span className="px-2 py-0.5 text-[10px] font-mono text-ink-dim border border-hairline bg-void uppercase shrink-0 flex items-center gap-1.5">
          <DailySilverSpark className="w-3.5 h-3.5 text-ink-dim shrink-0" />
          TODAY #2
        </span>
      ),
      numberClass: "text-ink-dim text-2xl sm:text-3xl",
      upvoteClass: "border-hairline text-ink-dim bg-void",
    };
  } else {
    return {
      cardClass: "border-b border-hairline group hover:bg-surface/20 transition-colors py-4",
      badge: (
        <span className="px-2 py-0.5 text-[10px] font-mono text-ink-faint border border-hairline bg-void uppercase shrink-0 flex items-center gap-1.5">
          <DailyBronzeLeaf className="w-3.5 h-3.5 text-ink-faint shrink-0" />
          TODAY #3
        </span>
      ),
      numberClass: "text-ink-faint text-2xl sm:text-3xl",
      upvoteClass: "border-hairline text-ink-faint bg-void",
    };
  }
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
}: {
  initialFeed?: HomeFeedInitialData;
  initialTab?: "daily" | "weekly" | "monthly" | "yearly" | "alltime";
  initialCategories?: { id?: string; slug: string; name: string; productCount: number }[];
  liveTopProducts?: LiveTopProductItem[];
}) {
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "monthly" | "yearly" | "alltime">(
    initialTab
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedData, setFeedData] = useState<HomeFeedInitialData>(
    initialFeed ?? { products: [], totalCount: 0, totalPages: 1 }
  );

  const tabCacheRef = useRef<Record<string, HomeFeedInitialData>>(
    initialFeed ? { [`${initialTab}_1`]: initialFeed } : {}
  );
  const isInitialMount = useRef(true);
  const feedContainerRef = useRef<HTMLDivElement>(null);

  const currentDate = new Date();
  const todayDateStr = format(currentDate, "dd MMM yyyy").toUpperCase();
  const currentWeekStr = `WEEK ${getWeek(currentDate)}`;
  const currentMonthStr = format(currentDate, "MMM''yy").toUpperCase();
  const currentYearStr = format(currentDate, "yyyy");

  const [, startTransition] = useTransition();

  // Fetch 50 products for the active tab and page with instant tab cache
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
      const newFeedData: HomeFeedInitialData = {
        products: data.products ?? [],
        totalCount: data.totalCount ?? 0,
        totalPages: data.totalPages ?? 1,
      };
      tabCacheRef.current[cacheKey] = newFeedData;
      setFeedData(newFeedData);
    } catch (err) {
      console.error("Failed to fetch board tab products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reaction to tab / page changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialFeed) {
        tabCacheRef.current[`${initialTab}_1`] = initialFeed;
        if (activeTab === initialTab) {
          return;
        }
      }
    }
    loadTabProducts(activeTab, currentPage);
  }, [activeTab, currentPage, initialFeed, initialTab, loadTabProducts]);

  // Handle URL query parameters for search and tab on mount/popstate
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlQuery = params.get("q") || params.get("search");
      if (urlQuery) setSearchQuery(urlQuery);

      const tabParam = params.get("tab") as "daily" | "weekly" | "monthly" | "yearly" | "alltime" | null;
      if (tabParam && ["daily", "weekly", "monthly", "yearly", "alltime"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  // Listen to search changes from header input
  useEffect(() => {
    const handleSearchChange = (e: Event) => {
      const customEv = e as CustomEvent;
      setSearchQuery(customEv.detail || "");
    };
    window.addEventListener("searchQueryChanged", handleSearchChange);
    return () => window.removeEventListener("searchQueryChanged", handleSearchChange);
  }, []);

  const handleTabChange = (tab: "daily" | "weekly" | "monthly" | "yearly" | "alltime") => {
    const cacheKey = `${tab}_1`;
    const cached = tabCacheRef.current[cacheKey];
    if (cached) {
      setFeedData(cached);
      setLoading(false);
    }
    startTransition(() => {
      setActiveTab(tab);
      setCurrentPage(1);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (tab === "daily") {
          url.searchParams.delete("tab");
        } else {
          url.searchParams.set("tab", tab);
        }
        window.history.pushState({}, "", url.toString());
      }
    });
  };

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const filteredProducts = isSearching
    ? feedData.products.filter(
        (p) =>
          p.name.toLowerCase().includes(trimmedQuery) ||
          p.tagline.toLowerCase().includes(trimmedQuery) ||
          p.maker.toLowerCase().includes(trimmedQuery) ||
          p.makerName.toLowerCase().includes(trimmedQuery) ||
          p.category.toLowerCase().includes(trimmedQuery)
      )
    : feedData.products;

  const displayProducts = isSearching ? filteredProducts : feedData.products;

  // Group products by category for Weekly and Monthly tabs
  const categoryGroups = (() => {
    if (activeTab !== "weekly" && activeTab !== "monthly") return [];

    const map = new Map<string, BoardRow[]>();
    displayProducts.forEach((p) => {
      const cat = p.category?.trim() || "General";
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(p);
    });

    return Array.from(map.entries()).map(([catName, prods]) => {
      const sorted = [...prods].sort(
        (a, b) => (b.votes ?? b.voteCount ?? 0) - (a.votes ?? a.voteCount ?? 0)
      );
      const matched = initialCategories?.find(
        (c) =>
          c.name.toLowerCase() === catName.toLowerCase() ||
          c.slug.toLowerCase() === slugify(catName)
      );
      return {
        name: catName,
        slug: matched?.slug || slugify(catName),
        totalCount: prods.length,
        top5: sorted.slice(0, 5),
      };
    });
  })();

  const isWeeklyOrMonthly = !isSearching && (activeTab === "weekly" || activeTab === "monthly");

  return (
    <MainLayoutShell>
      <div className="space-y-4" ref={feedContainerRef}>
        {/* Mobile-only timeframe tabs */}
        <div className="flex xl:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => handleTabChange("daily")}
            className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer shrink-0 ${
              activeTab === "daily"
                ? "bg-signal text-void font-bold border border-signal shadow-xs"
                : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink hover:bg-surface"
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => handleTabChange("weekly")}
            className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer shrink-0 ${
              activeTab === "weekly"
                ? "bg-signal text-void font-bold border border-signal shadow-xs"
                : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink hover:bg-surface"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => handleTabChange("monthly")}
            className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer shrink-0 ${
              activeTab === "monthly"
                ? "bg-signal text-void font-bold border border-signal shadow-xs"
                : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink hover:bg-surface"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => handleTabChange("yearly")}
            className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer shrink-0 ${
              activeTab === "yearly"
                ? "bg-signal text-void font-bold border border-signal shadow-xs"
                : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink hover:bg-surface"
            }`}
          >
            {currentYearStr}
          </button>
          <button
            onClick={() => handleTabChange("alltime")}
            className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer shrink-0 ${
              activeTab === "alltime"
                ? "bg-signal text-void font-bold border border-signal shadow-xs"
                : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink hover:bg-surface"
            }`}
          >
            All Time
          </button>
        </div>

        {/* Title section with all 5 timeframe tabs — Sticky with full opaque coverage */}
        <div className="sticky -top-4 z-20 bg-void -mt-4 pt-4 border-b border-hairline shrink-0">
          <div className="h-10 flex items-end justify-between pb-2.5">
            <div className="flex items-baseline gap-2.5 min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-black tracking-wider uppercase leading-none shrink-0">
                {isSearching
                  ? "Search Results"
                  : activeTab === "daily"
                  ? "Today"
                  : activeTab === "weekly"
                  ? "This Week"
                  : activeTab === "monthly"
                  ? "This Month"
                  : activeTab === "yearly"
                  ? "This Year"
                  : "All Time"}
              </h1>
              <span className="text-ink-dim text-xs font-mono tracking-wider leading-none pb-0.5 truncate hidden md:inline">
                {isSearching
                  ? `(${filteredProducts.length} found)`
                  : activeTab === "daily"
                  ? todayDateStr
                  : activeTab === "weekly"
                  ? currentWeekStr
                  : activeTab === "monthly"
                  ? currentMonthStr
                  : activeTab === "yearly"
                  ? currentYearStr
                  : "Rankings"}
              </span>
            </div>

            {/* Desktop Inline Timeframe Tabs — All 5 Tabs */}
            {!isSearching && (
              <div className="hidden xl:flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleTabChange("daily")}
                  className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer shrink-0 ${
                    activeTab === "daily"
                      ? "bg-signal text-void font-bold border border-signal shadow-xs"
                      : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink hover:bg-surface"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => handleTabChange("weekly")}
                  className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer shrink-0 ${
                    activeTab === "weekly"
                      ? "bg-signal text-void font-bold border border-signal shadow-xs"
                      : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink hover:bg-surface"
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => handleTabChange("monthly")}
                  className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer shrink-0 ${
                    activeTab === "monthly"
                      ? "bg-signal text-void font-bold border border-signal shadow-xs"
                      : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink hover:bg-surface"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => handleTabChange("yearly")}
                  className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer shrink-0 ${
                    activeTab === "yearly"
                      ? "bg-signal text-void font-bold border border-signal shadow-xs"
                      : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink hover:bg-surface"
                  }`}
                >
                  {currentYearStr}
                </button>
                <button
                  onClick={() => handleTabChange("alltime")}
                  className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer shrink-0 ${
                    activeTab === "alltime"
                      ? "bg-signal text-void font-bold border border-signal shadow-xs"
                      : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink hover:bg-surface"
                  }`}
                >
                  All Time
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Content View */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center border-b border-hairline bg-void min-h-[300px]">
            <LaunchFeedLoader size={36} />
          </div>
        ) : isWeeklyOrMonthly ? (
          /* ── CATEGORY TOP 5 VIEW FOR WEEKLY & MONTHLY ── */
          <div className="w-full space-y-8 min-w-0 pt-2">
            {categoryGroups.length > 0 ? (
              categoryGroups.map((group) => (
                <div key={group.name} className="space-y-3">
                  {/* Category Header */}
                  <div className="flex items-baseline justify-between border-b border-hairline pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-signal rounded-full shrink-0" />
                      <h2 className="font-display font-black text-base sm:text-lg uppercase text-ink tracking-wide">
                        {group.name}
                      </h2>
                      <span className="text-xs font-mono text-ink-dim">
                        ({group.totalCount} {group.totalCount === 1 ? "launch" : "launches"})
                      </span>
                    </div>
                    <Link
                      href={`/category/${group.slug}`}
                      className="text-[11px] font-mono text-signal hover:underline flex items-center gap-1 font-bold"
                    >
                      <span>Explore Category</span>
                      <span>→</span>
                    </Link>
                  </div>

                  {/* Top 5 Products Stack with 4-Side Bordered Individual Boxes */}
                  <div className="space-y-2.5">
                    {group.top5.map((prod, idx) => {
                      const catRank = idx + 1;
                      return (
                        <Link
                          key={prod.id}
                          href={`/product/${prod.slug || slugify(prod.name)}`}
                          prefetch={false}
                          className="border border-hairline bg-surface/20 hover:bg-surface/60 hover:border-signal/40 p-3 sm:p-3.5 rounded-xs transition-all flex items-center gap-3 sm:gap-4 group shadow-xs cursor-pointer block"
                        >
                          {/* Category Rank Badge */}
                          <span
                            className={`font-display font-black w-7 sm:w-9 text-center shrink-0 text-base sm:text-xl ${
                              catRank === 1
                                ? "text-signal font-bold"
                                : catRank === 2
                                ? "text-ink"
                                : catRank === 3
                                ? "text-ink-dim"
                                : "text-ink-faint"
                            }`}
                          >
                            #{String(catRank).padStart(2, "0")}
                          </span>

                          {/* Product Logo */}
                          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-surface border border-hairline flex-shrink-0 rounded-xs flex items-center justify-center font-mono text-[10px] sm:text-xs font-bold text-ink-dim overflow-hidden relative">
                            {prod.logoUrl ? (
                              <img
                                src={prod.logoUrl}
                                alt={prod.name}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              prod.name.substring(0, 2).toUpperCase()
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <h3 className="font-mono text-xs sm:text-sm font-medium text-ink group-hover:text-signal transition-colors truncate">
                                {prod.name}
                              </h3>
                              {catRank === 1 && (
                                <span className="px-1.5 py-0.2 text-[9px] font-mono tracking-wider text-signal border border-signal/40 bg-signal/10 uppercase font-bold">
                                  TOP #1
                                </span>
                              )}
                              <span className="text-ink-faint text-xs hidden md:inline">·</span>
                              <span className="text-ink-dim text-xs font-mono truncate hidden md:inline">
                                {prod.tagline}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-ink-dim truncate md:hidden mt-0.5">
                              {prod.tagline}
                            </div>
                            <div className="flex items-center gap-2 sm:gap-2.5 mt-1 text-[10px] sm:text-xs flex-wrap">
                              <span className="text-ink-faint group-hover:text-ink font-mono truncate">
                                {prod.maker} ({prod.makerName})
                              </span>
                              {prod.revenue && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold">
                                  {prod.revenue}
                                </span>
                              )}
                              <BookmarkButton productId={prod.id} />
                            </div>
                          </div>

                          {/* Upvote Button */}
                          <UpvoteButton
                            productId={prod.id}
                            voteCount={prod.votes ?? prod.voteCount ?? 0}
                            upvoteClass="border-hairline text-ink-dim hover:border-ink-faint bg-surface/50"
                          />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center border border-hairline bg-surface/15 p-6 rounded-xs">
                <div className="text-ink-dim font-mono text-sm mb-2">
                  No products found in this {activeTab === "weekly" ? "week" : "month"}.
                </div>
                <Link
                  href="/submit"
                  className="inline-block mt-2 px-4 py-2 border border-signal bg-signal/10 text-signal font-mono text-xs font-bold hover:bg-signal/20 transition-colors"
                >
                  Submit the First Launch →
                </Link>
              </div>
            )}
          </div>
        ) : (
          /* ── STANDARD UNIFIED LEADERBOARD LIST (Daily, Yearly, All-Time, Search) ── */
          <div className="divide-y divide-hairline">
            {displayProducts.length > 0 ? (
              displayProducts.map((prod, i) => {
                const rank = (currentPage - 1) * 50 + i + 1;
                const styles = getTop3Styles(rank, activeTab);

                return (
                  <Link
                    key={prod.id}
                    href={`/product/${prod.slug || slugify(prod.name)}`}
                    prefetch={false}
                    className={`flex items-center gap-2.5 sm:gap-4 py-3 sm:py-4 px-2 sm:px-4 cursor-pointer block ${styles.cardClass}`}
                  >
                    <span
                      className={`font-display font-black w-6 sm:w-12 text-center sm:text-right shrink-0 text-lg sm:text-3xl ${styles.numberClass}`}
                    >
                      {String(rank).padStart(rank >= 100 ? 3 : 2, "0")}
                    </span>

                    {/* Product Logo with Fallback to Initials */}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-surface border border-hairline flex-shrink-0 rounded-xs flex items-center justify-center font-mono text-[10px] sm:text-xs font-bold text-ink-dim overflow-hidden relative">
                      {prod.logoUrl ? (
                        <img
                          src={prod.logoUrl}
                          alt={prod.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        prod.name.substring(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <h3 className="font-mono text-xs sm:text-sm font-medium text-ink group-hover:text-signal transition-colors truncate">
                          {prod.name}
                        </h3>
                        {styles.badge}
                        <span className="text-ink-faint text-xs hidden md:inline">·</span>
                        <span className="text-ink-dim text-xs font-mono truncate hidden md:inline">
                          {prod.tagline}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-ink-dim truncate md:hidden mt-0.5">
                        {prod.tagline}
                      </div>
                      <div className="flex items-center gap-2 sm:gap-2.5 mt-1 text-[10px] sm:text-xs flex-wrap">
                        <span className="text-ink-faint group-hover:text-ink font-mono truncate">
                          {prod.maker} ({prod.makerName})
                        </span>
                        {/* Real Verified Category Badge */}
                        <span className="text-[9px] sm:text-xs font-mono px-1.5 py-0.5 border border-hairline text-ink-faint uppercase shrink-0">
                          {prod.category || "Tech"}
                        </span>
                        <BookmarkButton productId={prod.id} />
                      </div>
                    </div>

                    {/* Real Authoritative Upvote Button */}
                    <UpvoteButton
                      productId={prod.id}
                      voteCount={prod.votes ?? prod.voteCount ?? 0}
                      upvoteClass={styles.upvoteClass}
                    />
                  </Link>
                );
              })
            ) : (
              <div className="py-16 text-center border-b border-hairline">
                <div className="text-ink-dim font-mono text-sm mb-2">
                  {isSearching
                    ? `No products found matching "${searchQuery}"`
                    : `No products found in this timeframe.`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 50-Item Pagination Controls */}
        {!isSearching && feedData.totalPages > 1 && (
          <div className="flex items-center justify-between py-6 px-4 border-t border-b border-hairline bg-surface/30 font-mono text-xs">
            <button
              onClick={() => {
                const prev = Math.max(currentPage - 1, 1);
                setCurrentPage(prev);
                feedContainerRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              disabled={currentPage <= 1 || loading}
              className={`px-4 py-2 text-xs font-mono border transition-colors ${
                currentPage <= 1
                  ? "border-hairline text-ink-faint cursor-not-allowed opacity-40"
                  : "border-hairline bg-void text-ink hover:bg-surface cursor-pointer"
              }`}
            >
              ← Previous 50
            </button>

            <span className="text-xs font-mono text-ink-dim">
              Page <strong className="text-ink">{currentPage}</strong> of{" "}
              <strong className="text-ink">{feedData.totalPages}</strong> (
              {(currentPage - 1) * 50 + 1}–
              {Math.min(currentPage * 50, feedData.totalCount)} of {feedData.totalCount})
            </span>

            <button
              onClick={() => {
                const next = Math.min(currentPage + 1, feedData.totalPages);
                setCurrentPage(next);
                feedContainerRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              disabled={currentPage >= feedData.totalPages || loading}
              className={`px-4 py-2 text-xs font-mono border transition-colors ${
                currentPage >= feedData.totalPages
                  ? "border-hairline text-ink-faint cursor-not-allowed opacity-40"
                  : "border-signal/30 bg-signal/10 text-signal hover:bg-signal/20 cursor-pointer font-bold"
              }`}
            >
              Next 50 →
            </button>
          </div>
        )}

        {/* Rich Editorial Content, Features, Comparisons & SEO Section */}
        <HomeEditorialSection
          categories={initialCategories}
          liveProducts={liveTopProducts}
        />
      </div>
    </MainLayoutShell>
  );
}
