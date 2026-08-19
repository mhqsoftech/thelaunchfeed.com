"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { format, getWeek } from "date-fns";
import { LaunchFeedLogo, LaunchFeedBrandLogo } from "@/components/ui/LaunchFeedLogo";
import FeaturedOnFooterBar from "./components/FeaturedOnFooterBar";
import {
  slugify,
  getProductGradientClass,
  applyTheme,
  getActiveTheme,
  ThemeMode,
  getStoredSession,
  UserSession,
} from "./data";

/** Data shape returned by /api/layout-data. */
type LayoutSlot = {
  id: string;
  name: string;
  tagline: string;
  url: string;
  logoUrl?: string | null;
};
type LayoutProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  votes: number;
  maker: string;
  makerName: string;
  category: string;
  logoUrl?: string | null;
};

// Module-level in-memory cache to prevent layout flicker across client page transitions
let memoryLayoutCache: {
  featured: LayoutSlot[];
  rotating: LayoutSlot[];
  topProducts: LayoutProduct[];
  weeklyProducts?: LayoutProduct[];
  monthlyProducts?: LayoutProduct[];
} | null = null;

function getInitialLayoutData(): {
  featured: LayoutSlot[];
  rotating: LayoutSlot[];
  topProducts: LayoutProduct[];
} {
  if (memoryLayoutCache) return memoryLayoutCache;
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("tlf-layout-cache");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.topProducts) && parsed.topProducts.length > 0) {
          memoryLayoutCache = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return { featured: [], rotating: [], topProducts: [] };
}

const DEFAULT_CATEGORIES = [
  { slug: "ai", name: "AI & Machine Learning", productCount: 5 },
  { slug: "dev-tools", name: "Developer Tools", productCount: 4 },
  { slug: "design", name: "Design", productCount: 4 },
  { slug: "saas", name: "SaaS", productCount: 2 },
  { slug: "open-source", name: "Open Source", productCount: 2 },
  { slug: "productivity", name: "Productivity", productCount: 1 },
  { slug: "fintech", name: "Fintech", productCount: 1 },
  { slug: "seo-ai-visibility", name: "SEO & AI Visibility", productCount: 1 },
];

export default function MainLayoutShell({
  children,
  leftSidebar,
}: {
  children: React.ReactNode;
  leftSidebar?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const centerScrollRef = useRef<HTMLDivElement>(null);
  const [rotateIndex, setRotateIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    products: Array<{
      id: string;
      slug: string;
      name: string;
      tagline: string;
      logoUrl?: string | null;
      votes: number;
      category: string;
      categorySlug: string;
      maker: string;
      makerName: string;
    }>;
    founders: Array<{
      id: string;
      username: string;
      name: string;
      title: string;
      image?: string | null;
      bio?: string | null;
      level?: { level: number; label: string; tone: string; badge: string };
      productsCount: number;
      totalVotes: number;
    }>;
  }>({ products: [], founders: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousPageBeforeSearchRef = useRef<string | null>(null);

  // Global search effect across all database items
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults({ products: [], founders: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Global search query failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [mounted, setMounted] = useState(false);
  const [featured, setFeatured] = useState<LayoutSlot[]>([]);
  const [rotating, setRotating] = useState<LayoutSlot[]>([]);
  const [topProducts, setTopProducts] = useState<LayoutProduct[]>([]);
  const [weeklyProducts, setWeeklyProducts] = useState<LayoutProduct[]>([]);
  const [monthlyProducts, setMonthlyProducts] = useState<LayoutProduct[]>([]);
  const [categories, setCategories] = useState<{ id?: string; slug: string; name: string; productCount?: number }[]>(DEFAULT_CATEGORIES);
  const [topFounders, setTopFounders] = useState<any[]>([]);
  const [railTab, setRailTab] = useState<"weekly" | "monthly">("weekly");
  const [rightRailTab, setRightRailTab] = useState<"categories" | "founders">("categories");

  const currentRailProducts = railTab === "weekly" ? weeklyProducts : monthlyProducts;
  const railCategoryGroups = (() => {
    const map = new Map<string, LayoutProduct[]>();
    currentRailProducts.forEach((p) => {
      const cat = p.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    return Array.from(map.entries()).map(([catName, prods]) => {
      const sorted = [...prods].sort((a, b) => b.votes - a.votes);
      const matched = categories.find(
        (c) => c.name.toLowerCase() === catName.toLowerCase() || c.slug === slugify(catName)
      );
      return {
        name: catName,
        slug: matched?.slug || slugify(catName),
        top5: sorted.slice(0, 5),
      };
    });
  })();

  // Pull featured + rotating slots + weekly & monthly products from DB with stale-while-revalidate client caching.
  useEffect(() => {
    setMounted(true);
    // Instantly hydrate from client cache on mount without causing SSR hydration mismatches
    const initial = getInitialLayoutData();
    if (initial.topProducts.length > 0) {
      setFeatured(initial.featured);
      setRotating(initial.rotating);
      setTopProducts(initial.topProducts);
      setWeeklyProducts(initial.topProducts);
      setMonthlyProducts(initial.topProducts);
    }

    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/layout-data", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        const newWeekly = data.weeklyProducts ?? data.topProducts ?? [];
        const newMonthly = data.monthlyProducts ?? data.topProducts ?? [];
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
        if (Array.isArray(data.topFounders) && data.topFounders.length > 0) {
          setTopFounders(data.topFounders);
        }
        const newCache = {
          featured: data.featured ?? [],
          rotating: data.rotating ?? [],
          topProducts: newWeekly,
          weeklyProducts: newWeekly,
          monthlyProducts: newMonthly,
          topFounders: data.topFounders ?? [],
        };
        memoryLayoutCache = newCache;
        try {
          sessionStorage.setItem("tlf-layout-cache", JSON.stringify(newCache));
        } catch {}
        setFeatured(newCache.featured);
        setRotating(newCache.rotating);
        setTopProducts(newWeekly);
        setWeeklyProducts(newWeekly);
        setMonthlyProducts(newMonthly);
      } catch {}
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentDate = new Date();
  const currentWeekStr = `WEEK ${getWeek(currentDate)}`;
  const currentMonthStr = format(currentDate, "MMM''yy").toUpperCase();

  // Sync theme state and user session on mount
  useEffect(() => {
    setThemeMode(getActiveTheme());

    // Hydrate immediately from localStorage for fast paint, then always
    // verify against the server to catch stale / expired sessions.
    const stored = getStoredSession();
    if (stored) setUserSession(stored);

    const handleThemeChange = (e: Event) => {
      const customEv = e as CustomEvent<ThemeMode>;
      if (customEv.detail) {
        setThemeMode(customEv.detail);
      }
    };

    const handleAuthChange = (e: Event) => {
      const customEv = e as CustomEvent<UserSession | null>;
      const s = customEv.detail !== undefined ? customEv.detail : getStoredSession();
      setUserSession(s);
    };

    window.addEventListener("themeChanged", handleThemeChange);
    window.addEventListener("authChanged", handleAuthChange);

    return () => {
      window.removeEventListener("themeChanged", handleThemeChange);
      window.removeEventListener("authChanged", handleAuthChange);
    };
  }, []);

  // ⌘K Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Rotating products interval — 4 slots visible (2 left + 2 right).
  // Every 10s, advance by 4 so both pairs refresh together with the next
  // batch. Wraps around; no cap on how many slots the admin can add.
  useEffect(() => {
    if (rotating.length <= 4) return; // nothing to rotate to
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setRotateIndex((prev) => (prev + 4) % rotating.length);
        setIsFading(false);
      }, 500);
    }, 10000);

    return () => clearInterval(interval);
  }, [rotating.length]);

  const N = rotating.length;
  const pickAt = (offset: number) => (N > 0 ? rotating[(rotateIndex + offset) % N] : undefined);
  // Take at most 2 items per side and drop any undefined slots so the
  // renderer never sees a missing entry when the pool has < 4 items.
  const leftProducts = [pickAt(0), pickAt(1)].filter((p): p is LayoutSlot => !!p);
  const rightProducts = [pickAt(2), pickAt(3)].filter((p): p is LayoutSlot => !!p);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const liveSearchResults = trimmedQuery
    ? topProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(trimmedQuery) ||
          p.tagline.toLowerCase().includes(trimmedQuery) ||
          p.maker.toLowerCase().includes(trimmedQuery) ||
          p.makerName.toLowerCase().includes(trimmedQuery) ||
          p.category.toLowerCase().includes(trimmedQuery)
      ).slice(0, 8)
    : [];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-void text-ink font-mono">
      {/* Top Fixed Header: Sponsored strip + Search & Submit bar with rotating products */}
      <div className="shrink-0 z-30 bg-void border-b border-hairline">
        {/* Sponsored marquee strip — full width edge-to-edge floating products */}
        <div className="border-b border-hairline overflow-hidden relative w-full" suppressHydrationWarning>
          {mounted && featured.length > 0 ? (
            <div className="overflow-hidden w-full flex marquee-container" suppressHydrationWarning>
              <div className="marquee-track flex shrink-0 items-center" suppressHydrationWarning>
                {[...featured, ...featured].map((p, i) => (
                  <Link
                    key={i}
                    href={p.url && p.url !== "#" ? p.url : `/product/${slugify(p.name)}`}
                    className={`${getProductGradientClass(p.name)} flex-shrink-0 w-[180px] sm:w-[250px] mr-2 sm:mr-3 px-2.5 py-1.5 sm:px-3 sm:py-2 my-1.5 sm:my-2 border border-hairline bg-surface hover:bg-raised transition-colors cursor-pointer flex items-center gap-2.5`}
                  >
                    {/* Logo Icon */}
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xs bg-void border border-hairline flex-shrink-0 flex items-center justify-center font-mono text-[9px] font-bold text-ink-dim overflow-hidden relative">
                      {p.logoUrl ? (
                        <img width="64" height="64"
                          src={p.logoUrl}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        p.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-mono text-[11px] sm:text-xs font-medium text-ink truncate leading-tight">
                        {p.name}
                      </h4>
                      <p className="text-ink-dim text-[10px] sm:text-[11px] font-mono truncate mt-0.5 leading-tight">
                        {p.tagline}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="marquee-track flex shrink-0 items-center" aria-hidden="true">
                {[...featured, ...featured].map((p, i) => (
                  <Link
                    key={`clone-${i}`}
                    href={p.url && p.url !== "#" ? p.url : `/product/${slugify(p.name)}`}
                    className={`${getProductGradientClass(p.name)} flex-shrink-0 w-[180px] sm:w-[250px] mr-2 sm:mr-3 px-2.5 py-1.5 sm:px-3 sm:py-2 my-1.5 sm:my-2 border border-hairline bg-surface hover:bg-raised transition-colors cursor-pointer flex items-center gap-2.5`}
                  >
                    {/* Logo Icon */}
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xs bg-void border border-hairline flex-shrink-0 flex items-center justify-center font-mono text-[9px] font-bold text-ink-dim overflow-hidden relative">
                      {p.logoUrl ? (
                        <img width="64" height="64"
                          src={p.logoUrl}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        p.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-mono text-[11px] sm:text-xs font-medium text-ink truncate leading-tight">
                        {p.name}
                      </h4>
                      <p className="text-ink-dim text-[10px] sm:text-[11px] font-mono truncate mt-0.5 leading-tight">
                        {p.tagline}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-9 sm:h-12 w-full" />
          )}
        </div>

        {/* Search bar + Submit button with 2 left and 2 right rotating products expanding to edges */}
        <div className="w-full px-[10px] py-2.5 sm:py-3 flex items-center justify-between gap-4 sm:gap-6">
          {/* Left 2 Rotating Products expanding towards left edge */}
          <div className="hidden xl:flex items-center divide-x divide-hairline border-r border-hairline pr-4 sm:pr-6 shrink-0 w-[360px]">
            {leftProducts.map((p, i) => (
              <Link
                key={i}
                href={p.url && p.url !== "#" ? p.url : `/product/${slugify(p.name)}`}
                className={`${getProductGradientClass(p.name)} flex-1 min-w-0 px-2.5 py-1.5 transition-all duration-500 cursor-pointer hover:bg-surface flex items-center gap-2 ${
                  isFading ? "opacity-0 scale-95" : "opacity-100 scale-100"
                }`}
              >
                {/* Logo Icon */}
                <div className="w-6 h-6 rounded-xs bg-surface border border-hairline flex-shrink-0 flex items-center justify-center font-mono text-[9px] font-bold text-ink-dim overflow-hidden relative">
                  {p.logoUrl ? (
                    <img width="64" height="64"
                      src={p.logoUrl}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    p.name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="font-mono text-xs font-medium text-ink truncate leading-tight">
                    {p.name}
                  </h5>
                  <p className="text-ink-dim text-[11px] font-mono truncate mt-0.5 leading-tight">
                    {p.tagline}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Search bar + Submit button (Centered Prominent Search) */}
          <div className="w-full xl:w-auto flex-1 max-w-2xl flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="h-10 min-w-0 flex-1 border border-hairline bg-surface px-2.5 sm:px-4 flex items-center gap-2 focus-within:border-ink transition-colors">
              <kbd className="hidden sm:inline-flex text-ink-faint text-xs font-mono border border-hairline px-1.5 py-0.5 bg-void shrink-0">
                ⌘K
              </kbd>
              <input
                ref={inputRef}
                type="search"
                aria-label="Search products and makers"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  window.dispatchEvent(
                    new CustomEvent("searchQueryChanged", {
                      detail: val,
                    })
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchQuery("");
                    window.dispatchEvent(new CustomEvent("searchQueryChanged", { detail: "" }));
                  }
                }}
                placeholder="search products, makers..."
                className="w-full min-w-0 bg-transparent text-ink font-mono text-xs sm:text-sm placeholder:text-ink-faint focus:outline-none truncate"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    window.dispatchEvent(
                      new CustomEvent("searchQueryChanged", { detail: "" })
                    );
                  }}
                  className="text-ink-faint hover:text-ink text-xs font-mono px-1 shrink-0 cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Submit Button — Completely visible on mobile & desktop */}
            <Link
              href="/submit"
              className="h-10 px-2.5 sm:px-4 bg-signal text-void hover:opacity-90 border border-signal font-mono text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shadow-xs"
              title="Submit a product to The Launch Feed"
            >
              <span className="font-mono font-bold text-sm leading-none">+</span>
              <span className="inline sm:hidden font-bold">Submit</span>
              <span className="hidden sm:inline font-bold">Submit Product</span>
            </Link>

            {/* Auth Account Pill / Login Link — Uniform h-10 Height */}
            {userSession ? (
              <Link
                href="/profile"
                className="h-10 px-2.5 sm:px-3 border border-hairline bg-surface hover:bg-raised text-ink font-mono text-xs sm:text-sm font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title={`View ${userSession.name}'s Profile & Dashboard`}
              >
                <span className="w-5 h-5 rounded-xs bg-ink text-void text-[10px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                  {userSession.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img width="64" height="64"
                      src={userSession.image}
                      alt={`${userSession.name || "Your"} avatar`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    userSession.avatar
                  )}
                </span>
                <span className="hidden md:inline truncate">{userSession.handle}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="h-10 px-2.5 sm:px-3.5 border border-hairline bg-void hover:bg-surface text-ink font-mono text-xs sm:text-sm font-bold transition-colors shrink-0 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>[ Login ]</span>
              </Link>
            )}
          </div>

          {/* Right 2 Rotating Products expanding towards right edge */}
          <div className="hidden xl:flex items-center divide-x divide-hairline border-l border-hairline pl-4 sm:pl-6 shrink-0 w-[360px]">
            {rightProducts.map((p, i) => (
              <Link
                key={i}
                href={p.url && p.url !== "#" ? p.url : `/product/${slugify(p.name)}`}
                className={`${getProductGradientClass(p.name)} flex-1 min-w-0 px-2.5 py-1.5 transition-all duration-500 cursor-pointer hover:bg-surface flex items-center gap-2 ${
                  isFading ? "opacity-0 scale-95" : "opacity-100 scale-100"
                }`}
              >
                {/* Logo Icon */}
                <div className="w-6 h-6 rounded-xs bg-surface border border-hairline flex-shrink-0 flex items-center justify-center font-mono text-[9px] font-bold text-ink-dim overflow-hidden relative">
                  {p.logoUrl ? (
                    <img width="64" height="64"
                      src={p.logoUrl}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    p.name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="font-mono text-xs font-medium text-ink truncate leading-tight">
                    {p.name}
                  </h5>
                  <p className="text-ink-dim text-[11px] font-mono truncate mt-0.5 leading-tight">
                    {p.tagline}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Three-column layout — fixed sidebars, scrollable center launchpad */}
      <div className="flex-1 min-h-0 w-full px-[10px]">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full">
          {/* Left rail — Weekly & Monthly Top Products by Category */}
          <div className="hidden xl:flex xl:col-span-2 py-4 flex-col h-full min-h-0 overflow-hidden">
            {leftSidebar ? (
              leftSidebar
            ) : (
              <div className="flex flex-col h-full min-h-0">
                <div className="h-10 flex items-end pb-2.5 border-b border-hairline shrink-0">
                  <div className="w-full grid grid-cols-2 gap-1 bg-surface/60 p-0.5 border border-hairline rounded-xs text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setRailTab("weekly")}
                      className={`py-1 text-center rounded-xs transition-colors font-bold cursor-pointer ${
                        railTab === "weekly"
                          ? "bg-signal text-void shadow-xs"
                          : "text-ink-dim hover:text-ink hover:bg-surface/50"
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      onClick={() => setRailTab("monthly")}
                      className={`py-1 text-center rounded-xs transition-colors font-bold cursor-pointer ${
                        railTab === "monthly"
                          ? "bg-signal text-void shadow-xs"
                          : "text-ink-dim hover:text-ink hover:bg-surface/50"
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-between gap-4 pt-3 pr-1">
                  {railCategoryGroups.length > 0
                    ? railCategoryGroups.map((group) => (
                        <div key={group.name} className="space-y-1.5">
                          <div className="flex items-baseline justify-between border-b border-hairline pb-1">
                            <span className="text-[11px] font-mono font-bold text-ink uppercase truncate">
                              {group.name}
                            </span>
                            <Link
                              href={`/category/${group.slug}`}
                              className="text-[9px] font-mono text-signal hover:underline shrink-0 ml-1 font-bold"
                            >
                              Top 5 →
                            </Link>
                          </div>

                          <div className="space-y-1.5">
                            {group.top5.map((product, i) => (
                              <Link
                                key={product.id}
                                href={`/product/${product.slug || slugify(product.name)}`}
                                className="p-2 border border-hairline bg-surface/30 hover:bg-surface hover:border-signal/50 rounded-xs transition-all flex items-center gap-2 group block"
                              >
                                <span
                                  className={`font-display font-black text-xs w-4 text-center shrink-0 ${
                                    i === 0 ? "text-signal font-bold" : "text-ink-faint"
                                  }`}
                                >
                                  {String(i + 1).padStart(2, "0")}
                                </span>

                                <div className="w-5.5 h-5.5 rounded-xs bg-surface border border-hairline flex-shrink-0 flex items-center justify-center font-mono text-[9px] font-bold text-ink-dim overflow-hidden relative">
                                  {product.logoUrl ? (
                                    <img width="64" height="64"
                                      src={product.logoUrl}
                                      alt={product.name}
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    product.name.substring(0, 2).toUpperCase()
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-mono text-ink truncate font-medium group-hover:text-signal transition-colors">
                                    {product.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-ink-faint truncate">
                                    {product.maker}
                                  </div>
                                </div>

                                <div className="flex flex-col items-center shrink-0 px-0.5">
                                  <span className="text-[10px] font-mono font-bold text-ink-dim group-hover:text-signal">
                                    ▲{product.votes}
                                  </span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))
                    : Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="p-2 border border-hairline bg-surface/20 rounded-xs flex items-center gap-2 animate-pulse"
                        >
                          <div className="w-4 h-4 bg-surface/60 rounded-xs shrink-0" />
                          <div className="flex-1 space-y-1">
                            <div className="h-3 bg-surface/80 w-3/4 rounded-xs" />
                            <div className="h-2 bg-surface/40 w-1/2 rounded-xs" />
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            )}
          </div>

          {/* Daily center launchpad — scrollable feed + contained footer */}
          <div ref={centerScrollRef} className="xl:col-span-8 order-1 xl:order-2 py-4 flex flex-col h-full min-h-0 overflow-y-auto no-scrollbar justify-between">
            <div>
              {searchQuery.trim().length > 0 ? (
                <div className="space-y-6 font-mono text-ink">
                  {/* Search Results Header aligned with left & right sidebar headers */}
                  <div className="h-10 flex items-end justify-between pb-2.5 border-b border-hairline shrink-0">
                    <div className="flex items-baseline gap-3 min-w-0">
                      <h1 className="font-display text-xl sm:text-2xl font-black tracking-wider uppercase leading-none shrink-0 text-signal">
                        Search Results
                      </h1>
                      <span className="text-ink-dim text-xs sm:text-sm font-mono tracking-widest leading-none pb-0.5 truncate">
                        &ldquo;{searchQuery}&rdquo; ({searchResults.products.length + searchResults.founders.length} FOUND)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        window.dispatchEvent(new CustomEvent("searchQueryChanged", { detail: "" }));
                      }}
                      className="px-2.5 py-1 text-xs font-mono border border-hairline bg-surface hover:bg-raised text-ink-dim hover:text-ink transition-colors cursor-pointer shrink-0"
                    >
                      [ ✕ CLEAR SEARCH ]
                    </button>
                  </div>

                  {isSearching && (
                    <div className="p-4 border border-signal/40 bg-signal/5 text-xs text-signal flex items-center justify-between animate-pulse">
                      <span>[ QUERYING FULL POSTGRES REPOSITORY ACROSS PRODUCTS &amp; BUILDERS... ]</span>
                      <span className="w-2 h-2 rounded-full bg-signal" />
                    </div>
                  )}

                  {/* 1. MATCHING PRODUCTS */}
                  {searchResults.products.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-hairline pb-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-ink-dim">
                          Products ({searchResults.products.length})
                        </span>
                        <span className="text-[10px] text-ink-faint">ALL CATEGORIES</span>
                      </div>
                      <div className="divide-y divide-hairline border-b border-hairline">
                        {searchResults.products.map((p, i) => (
                          <Link
                            key={p.id}
                            href={`/product/${p.slug || slugify(p.name)}`}
                            onClick={() => {
                              setSearchQuery("");
                              window.dispatchEvent(new CustomEvent("searchQueryChanged", { detail: "" }));
                            }}
                            className="flex items-center gap-3 sm:gap-4 py-3.5 px-3 sm:px-4 group hover:bg-surface transition-colors cursor-pointer block"
                          >
                            <span
                              className={`font-display font-black text-xl sm:text-2xl w-8 sm:w-10 text-right ${
                                i === 0 ? "text-signal" : "text-ink-faint"
                              }`}
                            >
                              {String(i + 1).padStart(2, "0")}
                            </span>

                            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-surface border border-hairline flex-shrink-0 flex items-center justify-center font-mono font-bold text-xs text-ink group-hover:border-signal overflow-hidden relative">
                              {p.logoUrl ? (
                                <img width="64" height="64" src={p.logoUrl} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                              ) : (
                                <span>{p.name.substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-mono text-sm font-bold text-ink group-hover:text-signal transition-colors truncate">
                                  {p.name}
                                </h3>
                                <span className="text-ink-faint text-xs">·</span>
                                <span className="text-ink-dim text-xs font-mono truncate max-w-md">
                                  {p.tagline}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5 mt-1">
                                <span className="text-ink-faint group-hover:text-ink text-xs font-mono">
                                  {p.maker} ({p.makerName})
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 border border-hairline text-ink-faint uppercase">
                                  {p.category}
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0 border border-hairline px-3 py-1.5 bg-surface/50 group-hover:border-ink transition-colors">
                              <span className="font-mono text-xs font-bold text-signal block">{p.votes} VOTES</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. MATCHING FOUNDERS & BUILDERS */}
                  {searchResults.founders.length > 0 && (
                    <div className="space-y-3 pt-4">
                      <div className="flex items-center justify-between border-b border-hairline pb-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-signal">
                          Founders &amp; Builders ({searchResults.founders.length})
                        </span>
                        <span className="text-[10px] text-ink-faint">PRESTIGE DIRECTORY</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResults.founders.map((f) => (
                          <Link
                            key={f.id}
                            href={`/founder/${f.username}`}
                            onClick={() => {
                              setSearchQuery("");
                              window.dispatchEvent(new CustomEvent("searchQueryChanged", { detail: "" }));
                            }}
                            className="p-3.5 border border-hairline bg-surface/30 hover:border-ink hover:bg-surface transition-colors flex items-center gap-3.5 group"
                          >
                            <div className="w-11 h-11 bg-surface border border-hairline flex-shrink-0 flex items-center justify-center font-mono font-bold text-xs text-ink overflow-hidden relative">
                              {f.image ? (
                                <img width="64" height="64" src={f.image} alt={f.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                              ) : (
                                <span>{f.name.substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono text-xs sm:text-sm font-bold text-ink group-hover:text-signal transition-colors truncate">
                                  {f.name}
                                </span>
                                <span className="text-[10px] font-mono text-ink-faint truncate">
                                  @{f.username}
                                </span>
                              </div>
                              <p className="text-[11px] text-ink-dim truncate">
                                {f.title || "Independent Builder"}
                              </p>
                              <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-ink-faint">
                                <span className="text-signal font-bold">{f.productsCount} SHIPPED</span>
                                <span>·</span>
                                <span>{f.totalVotes} VOTES</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* EMPTY STATE */}
                  {!isSearching && searchResults.products.length === 0 && searchResults.founders.length === 0 && (
                    <div className="py-16 text-center border border-hairline bg-surface/20 space-y-2 p-6">
                      <div className="text-ink font-bold font-mono text-base">
                        No products or builders found matching &ldquo;{searchQuery}&rdquo;
                      </div>
                      <p className="text-ink-dim text-xs max-w-md mx-auto">
                        Try searching with a broader keyword, product name, founder username, or browse by category.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                children
              )}
            </div>

            {/* Unified Clean Modern Footer Section */}
            <footer className="mt-16 border-t border-hairline pt-10 pb-16 space-y-8 font-mono w-full shrink-0">
              {/* Row 1: Main 4-Column Navigation Grid — Balanced 4 Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-8 border-b border-hairline w-full">
                {/* Column 1: Brand, Motto & Social */}
                <div className="space-y-3.5 min-w-0">
                  <Link
                    href="/"
                    aria-label="The Launch Feed — home"
                    className="inline-flex items-center hover:opacity-85 transition-opacity"
                  >
                    <LaunchFeedBrandLogo height={38} />
                  </Link>
                  <p className="text-xs text-ink-dim leading-relaxed font-sans">
                    The 360° product intelligence platform &amp; daily leaderboard for indie makers, SaaS builders, and engineering teams.
                  </p>
                  <div className="text-[11px] font-mono text-signal font-bold pt-0.5">
                    ship. vote. rise.
                  </div>

                  {/* Official Social Icons */}
                  <div className="flex items-center gap-2 pt-1 text-ink-dim">
                    <a
                      href="https://x.com/thelaunchfeed"
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 border border-hairline bg-surface hover:text-ink hover:border-signal/40 transition-colors"
                      title="Follow @thelaunchfeed on 𝕏 (Twitter)"
                      aria-label="Follow on 𝕏 (Twitter)"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </a>
                    <a
                      href="https://bsky.app/profile/thelaunchfeed.bsky.social"
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 border border-hairline bg-surface hover:text-ink hover:border-signal/40 transition-colors"
                      title="Follow @thelaunchfeed.bsky.social on Bluesky"
                      aria-label="Follow on Bluesky"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 600 530" aria-hidden="true">
                        <path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.26-54.316 97.782-155.54 164.28-205.463C512.26 8.024 590 -19.44 590 69.24c0 17.7-10.15 148.79-16.11 170.07-20.68 73.94-96.14 92.86-163.23 81.42 117.3 19.95 147.16 86.06 82.72 152.16-122.34 125.55-175.83-31.51-189.53-71.76-2.51-7.38-3.68-10.83-3.85-7.88-.17-2.95-1.34.5-3.85 7.88-13.7 40.26-67.19 197.31-189.53 71.76-64.44-66.1-34.58-132.21 82.72-152.16-67.09 11.44-142.55-7.48-163.22-81.42C20.15 217.99 10 86.9 10 69.24c0-88.68 77.74-61.216 125.72-25.21z" />
                      </svg>
                    </a>
                    <a
                      href="https://t.me/thelaunchfeed"
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 border border-hairline bg-surface hover:text-ink hover:border-signal/40 transition-colors"
                      title="Telegram Channel"
                      aria-label="Telegram Channel"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                      </svg>
                    </a>
                    <a
                      href="https://chat.whatsapp.com/HxTenCRhtHa9PIviuQNl9U"
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 border border-hairline bg-surface hover:text-ink hover:border-signal/40 transition-colors"
                      title="WhatsApp Community"
                      aria-label="WhatsApp Community"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.79 14.07c-.24.68-1.2 1.26-1.66 1.32-.44.06-1.01.09-3.26-.84-2.73-1.13-4.48-3.9-4.62-4.08-.13-.19-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.24-.27.54-.34.72-.34.18 0 .36 0 .52.01.17.01.4.06.62.53.24.51.81 1.98.88 2.12.07.15.12.32.02.51-.09.19-.14.3-.29.47-.15.17-.31.38-.45.51-.15.15-.3.31-.13.61.17.3 1.05 1.74 2.26 2.82 1.55 1.38 2.86 1.81 3.27 2.01.41.2.65.17.89-.1.24-.27 1.03-1.2 1.3-1.61.27-.41.54-.34.91-.2.37.14 2.37 1.12 2.78 1.32.41.2.68.3.78.47.1.18.1.99-.14 1.67z" />
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Column 2: Leaderboards */}
                <div className="space-y-3 min-w-0">
                  <div className="text-xs font-bold text-ink uppercase tracking-wider border-b border-hairline pb-1.5 flex items-center justify-between">
                    <span>Leaderboards</span>
                    <span className="text-[9px] border border-signal/40 bg-signal/10 text-signal px-1 py-0.2 font-bold">DAILY</span>
                  </div>
                  <ul className="space-y-2 text-xs text-ink-dim">
                    <li>
                      <Link href="/" className="hover:text-ink transition-colors flex items-center gap-1.5 truncate">
                        <span>Today&apos;s Daily Feed</span>
                        <span className="text-[9px] border border-signal/40 text-signal px-1 py-0.2 shrink-0">LIVE</span>
                      </Link>
                    </li>
                    <li>
                      <Link href="/" className="hover:text-ink transition-colors block truncate">
                        Weekly Leaderboards
                      </Link>
                    </li>
                    <li>
                      <Link href="/" className="hover:text-ink transition-colors block truncate">
                        Monthly Leaderboards
                      </Link>
                    </li>
                    <li>
                      <Link href="/" className="hover:text-ink transition-colors block truncate">
                        2026 Yearly Champions
                      </Link>
                    </li>
                    <li>
                      <Link href="/" className="hover:text-ink transition-colors block truncate">
                        All-Time Hall of Fame
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Column 3: Platform */}
                <div className="space-y-3 min-w-0">
                  <div className="text-xs font-bold text-ink uppercase tracking-wider border-b border-hairline pb-1.5 flex items-center justify-between">
                    <span>Platform</span>
                    <span className="text-[9px] text-ink-faint font-normal">DISCOVER</span>
                  </div>
                  <ul className="space-y-2 text-xs text-ink-dim">
                    <li>
                      <Link href="/founders" className="hover:text-ink transition-colors flex items-center gap-1.5 truncate">
                        <span className="font-bold text-ink hover:text-signal truncate">Top 100 Founders</span>
                        <span className="text-[9px] border border-signal/40 bg-signal/10 text-signal px-1 py-0.2 font-bold shrink-0">TOP 100</span>
                      </Link>
                    </li>
                    <li>
                      <Link href="/submit" className="hover:text-ink transition-colors flex items-center gap-1.5 truncate">
                        <span className="truncate">Submit a Launch</span>
                        <span className="text-[9px] border border-signal/40 text-signal px-1 py-0.2 shrink-0">$0 FREE</span>
                      </Link>
                    </li>
                    <li>
                      <Link href="/profile" className="hover:text-ink transition-colors block truncate">
                        Maker Dashboard
                      </Link>
                    </li>
                    <li>
                      <Link href="/login" className="hover:text-ink transition-colors block truncate">
                        Sign In / Register
                      </Link>
                    </li>
                    <li>
                      <a href="/sitemap.xml" className="hover:text-ink transition-colors block truncate">
                        XML Sitemap
                      </a>
                    </li>
                  </ul>
                </div>

                {/* Column 4: Company & Legal */}
                <div className="space-y-3 min-w-0">
                  <div className="text-xs font-bold text-ink uppercase tracking-wider border-b border-hairline pb-1.5 flex items-center justify-between">
                    <span>Company</span>
                    <span className="text-[9px] text-ink-faint font-normal">LEGAL</span>
                  </div>
                  <ul className="space-y-2 text-xs text-ink-dim">
                    <li>
                      <Link href="/about" className="hover:text-ink transition-colors block truncate">
                        About Platform
                      </Link>
                    </li>
                    <li>
                      <Link href="/contact" className="hover:text-ink transition-colors block truncate">
                        Contact &amp; Support
                      </Link>
                    </li>
                    <li>
                      <Link href="/privacy" className="hover:text-ink transition-colors block truncate">
                        Privacy Policy
                      </Link>
                    </li>
                    <li>
                      <Link href="/terms" className="hover:text-ink transition-colors block truncate">
                        Terms of Service
                      </Link>
                    </li>
                    <li>
                      <a
                        href="/llms.txt"
                        target="_blank"
                        className="hover:text-ink transition-colors flex items-center gap-1 text-signal font-medium truncate"
                      >
                        <span className="truncate">AI Feed (llms.txt)</span>
                        <span className="text-[9px] shrink-0">↗</span>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Row 2: Categories Section */}
              <div className="space-y-3 pb-8 border-b border-hairline w-full">
                <div className="text-xs font-bold text-ink uppercase tracking-wider flex items-center justify-between">
                  <span>Explore Categories</span>
                  <span className="text-[10px] text-ink-faint font-normal">{categories.length} niches</span>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      className="px-2.5 py-1 text-[11px] font-mono border border-hairline bg-surface/30 hover:bg-surface hover:border-signal/40 hover:text-signal text-ink-dim transition-all flex items-center gap-1.5 cursor-pointer rounded-xs"
                    >
                      <span>{cat.name}</span>
                      <span className="text-ink-faint text-[9px]">→</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Featured On Online Directories Marquee Strip */}
              <FeaturedOnFooterBar />

              {/* Row 3: Bottom Creator Attribution & Theme Controls Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1 text-xs text-ink-faint w-full">
                {/* Left: Creator Attribution with Avatar */}
                <div className="flex items-center gap-2 px-2.5 py-1 border border-hairline bg-surface/40 h-8 shrink-0">
                  <img width="64" height="64"
                    src="/menajulm.avif"
                    alt="Menajul Hoque"
                    className="w-4 h-4 rounded-full object-cover grayscale opacity-85 hover:grayscale-0 hover:opacity-100 transition-all border border-hairline"
                  />
                  <span className="text-[11px] font-mono text-ink-faint">Built by</span>
                  <a
                    href="https://x.com/menajulm"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-mono font-bold text-ink hover:text-signal hover:underline transition-colors"
                  >
                    @menajulm (x)
                  </a>
                </div>

                {/* Center: Copyright */}
                <div className="text-[11px] font-mono text-ink-faint tracking-wider uppercase text-center sm:text-left truncate">
                  &copy; {new Date().getFullYear()} THE LAUNCH FEED &middot; ALL RIGHTS RESERVED
                </div>

                {/* Right: Theme Controls & TOP Button */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* 3-Theme Segmented Control */}
                  <div className="flex items-center border border-hairline bg-surface/40 p-0.5 rounded-sm gap-0.5 h-8">
                    <button
                      onClick={() => applyTheme("light")}
                      className={`w-7 h-7 flex items-center justify-center transition-colors cursor-pointer rounded-xs ${
                        themeMode === "light"
                          ? "bg-ink text-void font-bold"
                          : "text-ink-dim hover:text-ink hover:bg-surface"
                      }`}
                      title="Light Mode"
                      aria-label="Light Mode"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
                        <path strokeLinecap="square" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                      </svg>
                    </button>
                    <button
                      onClick={() => applyTheme("void")}
                      className={`w-7 h-7 flex items-center justify-center transition-colors cursor-pointer rounded-xs ${
                        themeMode === "void"
                          ? "bg-ink text-void font-bold"
                          : "text-ink-dim hover:text-ink hover:bg-surface"
                      }`}
                      title="Void Dark Mode"
                      aria-label="Void Dark Mode"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="square" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor" fillOpacity="0.2" />
                      </svg>
                    </button>
                    <button
                      onClick={() => applyTheme("thermal")}
                      className={`w-7 h-7 flex items-center justify-center transition-colors cursor-pointer rounded-xs ${
                        themeMode === "thermal"
                          ? "bg-[#38BDF8] text-[#050B14] font-bold"
                          : "text-ink-dim hover:text-ink hover:bg-surface"
                      }`}
                      title="Thermal Dark Mode"
                      aria-label="Thermal Dark Mode"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="square" d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3.5z" fill="currentColor" fillOpacity="0.3" />
                      </svg>
                    </button>
                  </div>

                  {/* TOP Button */}
                  <button
                    onClick={() => {
                      if (centerScrollRef.current) {
                        centerScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
                      }
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="h-8 px-3 flex items-center gap-1.5 justify-center border border-hairline bg-surface/40 hover:bg-raised text-[11px] font-mono font-bold text-ink hover:text-signal transition-colors cursor-pointer rounded-sm uppercase shrink-0"
                  >
                    <span>TOP</span>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="square" strokeLinejoin="miter" d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </footer>
          </div>

          {/* Right rail — Product Categories & Top Builders Subtabs */}
          <div className="hidden xl:flex xl:col-span-2 py-4 flex-col h-full min-h-0 overflow-hidden order-3">
            <div className="h-10 flex items-end pb-2.5 border-b border-hairline shrink-0">
              <div className="w-full grid grid-cols-2 gap-1 bg-surface/60 p-0.5 border border-hairline rounded-xs text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setRightRailTab("categories")}
                  className={`py-1 px-1 text-center rounded-xs transition-colors font-bold cursor-pointer text-[11px] sm:text-xs truncate ${
                    rightRailTab === "categories"
                      ? "bg-signal text-void shadow-xs"
                      : "text-ink-dim hover:text-ink hover:bg-surface/50"
                  }`}
                >
                  Categories
                </button>
                <button
                  type="button"
                  onClick={() => setRightRailTab("founders")}
                  className={`py-1 px-1 flex items-center justify-center gap-1 rounded-xs transition-colors font-bold cursor-pointer text-[11px] sm:text-xs truncate ${
                    rightRailTab === "founders"
                      ? "bg-signal text-void shadow-xs"
                      : "text-ink-dim hover:text-ink hover:bg-surface/50"
                  }`}
                >
                  <svg
                    className="w-3 h-3 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="square" strokeLinejoin="miter" d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                  <span>10 Founders</span>
                </button>
              </div>
            </div>

            {rightRailTab === "categories" ? (
              <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-between gap-1.5 pt-3 pr-1">
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    className="p-2.5 border border-hairline bg-surface/30 hover:bg-surface hover:border-signal/50 rounded-xs transition-all flex items-center justify-between group"
                  >
                    <span className="text-xs font-mono font-medium text-ink group-hover:text-signal transition-colors truncate">
                      {cat.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-1.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-surface border border-hairline text-ink-dim group-hover:text-ink">
                        {cat.productCount ?? 0}
                      </span>
                      <span className="text-ink-faint group-hover:text-signal font-mono text-[10px]">
                        →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              /* ── Top 10 Builders / Founders View ── */
              <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-between gap-1.5 pt-3 pr-1">
                {topFounders.length > 0
                  ? topFounders.slice(0, 10).map((f, i) => (
                      <Link
                        key={f.id || f.username}
                        href={`/founder/${f.username}`}
                        className="p-2 border border-hairline bg-surface/30 hover:bg-surface hover:border-signal/50 rounded-xs transition-all flex items-center gap-2 group block"
                      >
                        <span
                          className={`font-display font-black text-xs w-4 text-center shrink-0 ${
                            i === 0
                              ? "text-signal font-bold"
                              : i === 1
                              ? "text-signal/80 font-bold"
                              : i === 2
                              ? "text-signal/60 font-bold"
                              : "text-ink-faint"
                          }`}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>

                        <div className="w-5.5 h-5.5 rounded-full bg-surface border border-hairline flex-shrink-0 flex items-center justify-center font-mono text-[9px] font-bold text-ink-dim overflow-hidden relative">
                          {f.image ? (
                            <img width="64" height="64" src={f.image} alt={f.name || f.username} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            (f.name || f.username).substring(0, 2).toUpperCase()
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono text-ink truncate font-medium group-hover:text-signal transition-colors">
                            {f.name || f.username}
                          </div>
                          <div className="text-[10px] font-mono text-ink-faint truncate">
                            @{f.username}
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 px-0.5">
                          <span className="text-[10px] font-mono font-bold text-ink-dim group-hover:text-signal">
                            {f.totalVotes ? `▲${f.totalVotes}` : `${f.productsCount || 0} shipped`}
                          </span>
                        </div>
                      </Link>
                    ))
                  : Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="p-2 border border-hairline bg-surface/20 rounded-xs flex items-center gap-2 animate-pulse"
                      >
                        <div className="w-5.5 h-5.5 bg-surface/60 rounded-full shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-surface/80 w-3/4 rounded-xs" />
                          <div className="h-2 bg-surface/40 w-1/2 rounded-xs" />
                        </div>
                      </div>
                    ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-only floating bottom marquee — single row, right-to-left */}
      {mounted && rotating.length > 0 && (
        <div className="xl:hidden shrink-0 z-30 bg-void border-t border-hairline overflow-hidden relative w-full">
          <div className="overflow-hidden w-full flex flex-nowrap marquee-container">
            {[0, 1].map((trackIdx) => (
              <div
                key={trackIdx}
                aria-hidden={trackIdx === 1 ? "true" : undefined}
                className="marquee-track flex flex-nowrap shrink-0 items-center"
                style={{ animationDirection: "reverse", animationDuration: "120s" }}
              >
                {[...rotating, ...rotating].map((p, i) => (
                  <Link
                    key={`${trackIdx}-${i}`}
                    href={p.url && p.url !== "#" ? p.url : `/product/${slugify(p.name)}`}
                    className={`${getProductGradientClass(p.name)} flex-shrink-0 w-[180px] sm:w-[250px] mr-2 sm:mr-3 px-2.5 py-1.5 sm:px-3 sm:py-2 my-1.5 sm:my-2 border border-hairline bg-surface hover:bg-raised transition-colors cursor-pointer flex items-center gap-2.5`}
                  >
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xs bg-void border border-hairline flex-shrink-0 flex items-center justify-center font-mono text-[9px] font-bold text-ink-dim overflow-hidden relative">
                      {p.logoUrl ? (
                        <img width="64" height="64" src={p.logoUrl} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        p.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-mono text-[11px] sm:text-xs font-medium text-ink truncate leading-tight">
                        {p.name}
                      </h4>
                      <p className="text-ink-dim text-[10px] sm:text-[11px] font-mono truncate mt-0.5 leading-tight">
                        {p.tagline}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
