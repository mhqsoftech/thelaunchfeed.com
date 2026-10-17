"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LaunchFeedLogo } from "@/components/ui/LaunchFeedLogo";
import FeaturedOnFooterBar from "./components/FeaturedOnFooterBar";
import { openCookieSettings } from "./lib/cookieConsent";
import { NextLaunchCountdown } from "@/components/ui/NextLaunchCountdown";
import { useLocalLaunchTime } from "@/components/ui/LaunchTime";
import { OutboundLink } from "@/components/ui/OutboundLink";
import { goHref } from "@/lib/outbound/links";
import {
  slugify,
  formatProductWebsiteUrl,
  applyTheme,
  getActiveTheme,
  ThemeMode,
  getStoredSession,
  UserSession,
} from "./data";

/** Data shape returned by /api/layout-data. */
type LayoutSlot = {
  id: string;
  kind?: "PAID" | "CUSTOM";
  name: string;
  tagline: string;
  url: string;
  /** true → the maker's own website (opens in a new tab). */
  external?: boolean;
  logoUrl?: string | null;
  /** Linked product, for click counting via /go/<productSlug>. */
  productSlug?: string | null;
  slotId?: string | null;
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
type LayoutFounder = {
  id?: string;
  username: string;
  name?: string;
  image?: string | null;
  totalVotes?: number;
  productsCount?: number;
};
type LayoutCategory = { id?: string; slug: string; name: string; productCount?: number };

type LayoutCache = {
  featured: LayoutSlot[];
  rotating: LayoutSlot[];
  weeklyProducts: LayoutProduct[];
  monthlyProducts: LayoutProduct[];
  topFounders: LayoutFounder[];
  categories?: LayoutCategory[];
};

// Module-level cache so client-side navigations never flash empty rails.
let memoryLayoutCache: LayoutCache | null = null;

function readLayoutCache(): LayoutCache | null {
  if (memoryLayoutCache) return memoryLayoutCache;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("tlf-layout-cache-v2");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LayoutCache>;
    memoryLayoutCache = {
      featured: parsed.featured ?? [],
      rotating: parsed.rotating ?? [],
      weeklyProducts: parsed.weeklyProducts ?? [],
      monthlyProducts: parsed.monthlyProducts ?? [],
      topFounders: parsed.topFounders ?? [],
      categories: parsed.categories,
    };
    return memoryLayoutCache;
  } catch {
    return null;
  }
}

const DEFAULT_CATEGORIES: LayoutCategory[] = [
  { slug: "ai", name: "AI & Machine Learning" },
  { slug: "dev-tools", name: "Developer Tools" },
  { slug: "design", name: "Design" },
  { slug: "saas", name: "SaaS" },
  { slug: "open-source", name: "Open Source" },
  { slug: "productivity", name: "Productivity" },
  { slug: "fintech", name: "Fintech" },
  { slug: "seo-ai-visibility", name: "SEO & AI Visibility" },
];

const NAV_ITEMS: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: "/", label: "Today", match: (p) => p === "/" },
  { href: "/leaderboard/weekly", label: "Leaderboards", match: (p) => p.startsWith("/leaderboard") },
  { href: "/categories", label: "Categories", match: (p) => p.startsWith("/categor") },
  { href: "/founders", label: "Founders", match: (p) => p.startsWith("/founder") },
  { href: "/badges", label: "Badges", match: (p) => p.startsWith("/badges") },
];

/**
 * Featured / Spotlight cards link straight to the maker's website (the URL
 * entered at submission) with ?ref=thelaunchfeed attribution, counted via
 * /go/<slug>?src=featured|spotlight. Paid slots are marked rel="sponsored"
 * as Google requires for paid placements.
 */
function SlotLink({
  slot,
  src,
  className,
  tabIndex,
  children,
}: {
  slot: LayoutSlot;
  src: "featured" | "spotlight";
  className?: string;
  tabIndex?: number;
  children: React.ReactNode;
}) {
  const external = slot.external ?? /^https?:\/\//i.test(slot.url || "");
  if (external) {
    const rel = slot.kind === "PAID" ? "sponsored noopener" : "noopener";
    if (slot.productSlug) {
      return (
        <OutboundLink
          href={formatProductWebsiteUrl(slot.url)}
          goHref={goHref(slot.productSlug, src, slot.slotId)}
          rel={rel}
          className={className}
          tabIndex={tabIndex}
          title={`Visit ${slot.name}`}
        >
          {children}
        </OutboundLink>
      );
    }
    return (
      <a
        href={formatProductWebsiteUrl(slot.url)}
        target="_blank"
        rel={rel}
        className={className}
        tabIndex={tabIndex}
        title={`Visit ${slot.name}`}
      >
        {children}
      </a>
    );
  }
  const href = slot.url && slot.url !== "#" ? slot.url : `/product/${slugify(slot.name)}`;
  return (
    <Link href={href} className={className} tabIndex={tabIndex}>
      {children}
    </Link>
  );
}

/* ─────────────────────────── small pieces ─────────────────────────── */

function Avatar({
  src,
  name,
  size = 32,
  round = false,
}: {
  src?: string | null;
  name: string;
  size?: number;
  round?: boolean;
}) {
  return (
    <span
      className={`shrink-0 overflow-hidden border border-hairline bg-surface flex items-center justify-center text-[10px] font-mono font-bold text-ink-dim ${
        round ? "rounded-full" : "rounded-lg"
      }`}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        name.substring(0, 2).toUpperCase()
      )}
    </span>
  );
}

function Icon({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  search: "M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3",
  plus: "M12 5v14M5 12h14",
  user: "M20 21a8 8 0 1 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  close: "M18 6 6 18M6 6l12 12",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
};

/** The brand's 2×2 signal matrix; a lit square sweeps around it like radar. */
function SignalMatrix({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="tlf-matrix shrink-0" aria-hidden="true" style={{ shapeRendering: "crispEdges" }}>
      <rect x="0.5" y="0.5" width="6.5" height="6.5" />
      <rect x="9" y="0.5" width="6.5" height="6.5" />
      <rect x="9" y="9" width="6.5" height="6.5" />
      <rect x="0.5" y="9" width="6.5" height="6.5" />
    </svg>
  );
}

/** Primary CTA — same pill geometry as the "Log in" button beside it. */
function LaunchButton() {
  const local = useLocalLaunchTime();
  return (
    <Link
      href="/submit"
      className="tlf-launch group hidden sm:inline-flex items-center gap-2.5 h-10 pl-4 pr-5 rounded-full text-sm font-semibold whitespace-nowrap"
      title={`Submit your product — next batch goes live at ${local?.label ?? "6:00 AM IST"}`}
    >
      <span className="tlf-launch-main absolute inset-0 rounded-full" aria-hidden />
      <SignalMatrix size={15} />
      <span className="relative">Submit product</span>
    </Link>
  );
}

/** Countdown pill to the next 6:00 AM IST batch (wide screens). */
function NextBatchPill() {
  return (
    <span className="hidden 2xl:inline-flex">
      <NextLaunchCountdown variant="compact" />
    </span>
  );
}

/**
 * Off-desktop Spotlight: a single non-scrolling row of logo + name chips.
 * The row holds as many as the screen fits (3 on small phones → 6 on
 * tablets) and advances to the next set of paid slots every 15 seconds.
 */
function MobileSpotlight({ slots }: { slots: LayoutSlot[] }) {
  const [perRow, setPerRow] = useState(3);
  const [page, setPage] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth;
      setPerRow(w < 400 ? 3 : w < 560 ? 4 : w < 900 ? 5 : 6);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const count = Math.min(perRow, slots.length);
  const pages = Math.max(1, Math.ceil(slots.length / perRow));

  useEffect(() => {
    setPage((p) => p % pages);
  }, [pages]);

  useEffect(() => {
    if (pages <= 1) return;
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPage((p) => (p + 1) % pages);
        setFading(false);
      }, 300);
    }, 15_000);
    return () => clearInterval(id);
  }, [pages]);

  // Wrap around so the last set is always a full row.
  const visible = Array.from({ length: count }, (_, i) => slots[(page * perRow + i) % slots.length]);

  return (
    <section aria-label="Spotlight (sponsored)" className="xl:hidden mb-5">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">Spotlight · Sponsored</span>
        {pages > 1 && (
          <span className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: pages }, (_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all ${i === page ? "w-3 bg-signal" : "w-1 bg-hairline"}`} />
            ))}
          </span>
        )}
      </div>
      <ul
        className={`grid gap-1.5 transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {visible.map((p, i) => (
          <li key={`${p.id}-${i}`} className="min-w-0">
            <SlotLink
              slot={p}
              src="spotlight"
              className="flex items-center gap-1.5 min-w-0 h-10 pl-1.5 pr-2.5 rounded-full border border-hairline bg-card hover:border-signal/50 transition-colors"
            >
              <Avatar src={p.logoUrl} name={p.name} size={26} round />
              <span className="min-w-0 truncate text-xs font-semibold text-ink">{p.name}</span>
            </SlotLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────────────────────── shell ─────────────────────────── */

export default function MainLayoutShell({
  children,
  leftSidebar,
  rails = true,
}: {
  children: React.ReactNode;
  /** Replaces the left "top this week" rail (e.g. the submit wizard's progress). */
  leftSidebar?: React.ReactNode;
  /** false = single centered reading column (legal / about / contact pages). */
  rails?: boolean;
}) {
  const pathname = usePathname() || "/";
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
      productsCount: number;
      totalVotes: number;
    }>;
  }>({ products: [], founders: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);
  const [featured, setFeatured] = useState<LayoutSlot[]>([]);
  const [rotating, setRotating] = useState<LayoutSlot[]>([]);
  const [weeklyProducts, setWeeklyProducts] = useState<LayoutProduct[]>([]);
  const [monthlyProducts, setMonthlyProducts] = useState<LayoutProduct[]>([]);
  const [categories, setCategories] = useState<LayoutCategory[]>(DEFAULT_CATEGORIES);
  const [topFounders, setTopFounders] = useState<LayoutFounder[]>([]);
  const [railTab, setRailTab] = useState<"weekly" | "monthly">("weekly");
  const [rightRailTab, setRightRailTab] = useState<"categories" | "founders">("categories");

  // Global search across products + founders (debounced).
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
        if (res.ok) setSearchResults(await res.json());
      } catch (err) {
        console.error("Global search query failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Layout data (spotlight slots, rails) with stale-while-revalidate caching.
  useEffect(() => {
    setMounted(true);
    const cached = readLayoutCache();
    if (cached) {
      setFeatured(cached.featured);
      setRotating(cached.rotating);
      setWeeklyProducts(cached.weeklyProducts);
      setMonthlyProducts(cached.monthlyProducts);
      if (cached.topFounders.length) setTopFounders(cached.topFounders);
      if (cached.categories?.length) setCategories(cached.categories);
      setIsLoadingLayout(false);
    }

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/layout-data");
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        const weekly: LayoutProduct[] = data.weeklyProducts ?? data.topProducts ?? [];
        const monthly: LayoutProduct[] = data.monthlyProducts ?? data.topProducts ?? [];
        const next: LayoutCache = {
          featured: data.featured ?? [],
          rotating: data.rotating ?? [],
          weeklyProducts: weekly,
          monthlyProducts: monthly,
          topFounders: data.topFounders ?? [],
          categories: Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : undefined,
        };
        memoryLayoutCache = next;
        try {
          sessionStorage.setItem("tlf-layout-cache-v2", JSON.stringify(next));
        } catch {}
        setFeatured(next.featured);
        setRotating(next.rotating);
        setWeeklyProducts(weekly);
        setMonthlyProducts(monthly);
        if (next.topFounders.length) setTopFounders(next.topFounders);
        if (next.categories) setCategories(next.categories);
      } catch (err) {
        console.error("Layout data fetch error:", err);
      } finally {
        if (!cancelled) setIsLoadingLayout(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Theme + session sync.
  useEffect(() => {
    setThemeMode(getActiveTheme());
    const stored = getStoredSession();
    if (stored) setUserSession(stored);
    const onTheme = (e: Event) => {
      const d = (e as CustomEvent<ThemeMode>).detail;
      if (d) setThemeMode(d);
    };
    const onAuth = (e: Event) => {
      const d = (e as CustomEvent<UserSession | null>).detail;
      setUserSession(d !== undefined ? d : getStoredSession());
    };
    window.addEventListener("themeChanged", onTheme);
    window.addEventListener("authChanged", onAuth);
    return () => {
      window.removeEventListener("themeChanged", onTheme);
      window.removeEventListener("authChanged", onAuth);
    };
  }, []);

  // ⌘K / Ctrl+K / "/" focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, [contenteditable=true]");
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        if (window.matchMedia("(min-width: 1024px)").matches) {
          inputRef.current?.focus();
        } else {
          setMobileSearchOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 30);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Spotlight rotation: 4 visible paid slots, advance every 10s.
  useEffect(() => {
    if (rotating.length <= 4) return;
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setRotateIndex((prev) => (prev + 4) % rotating.length);
        setIsFading(false);
      }, 400);
    }, 10000);
    return () => clearInterval(interval);
  }, [rotating.length]);

  // Keep html scroll-padding in sync with the pinned header height.
  useEffect(() => {
    document.documentElement.style.setProperty("--tlf-header-h", `${mounted && featured.length > 0 ? 100 : 60}px`);
  }, [mounted, featured.length]);

  // Deep links like /?q=notion (the WebSite SearchAction target) open search.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearchQuery(q);
  }, []);

  // Close the mobile search sheet on navigation.
  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  const N = rotating.length;
  const spotlight = Array.from({ length: Math.min(4, N) }, (_, i) => rotating[(rotateIndex + i) % N]);

  const updateSearch = (val: string) => {
    setSearchQuery(val);
    window.dispatchEvent(new CustomEvent("searchQueryChanged", { detail: val }));
  };
  const clearSearch = () => updateSearch("");

  const railProducts = railTab === "weekly" ? weeklyProducts : monthlyProducts;
  const railGroups = (() => {
    const map = new Map<string, LayoutProduct[]>();
    railProducts.forEach((p) => {
      const cat = p.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    return Array.from(map.entries()).map(([name, prods]) => {
      const matched = categories.find((c) => c.name.toLowerCase() === name.toLowerCase() || c.slug === slugify(name));
      return {
        name,
        slug: matched?.slug || slugify(name),
        top: [...prods].sort((a, b) => b.votes - a.votes).slice(0, 5),
      };
    });
  })();


  const searching = searchQuery.trim().length > 0;
  const showFeatured = mounted && featured.length > 0;
  const headerH = showFeatured ? 100 : 60;

  /* ─────────── search field (shared by desktop + mobile) ─────────── */
  const searchField = (ref: React.RefObject<HTMLInputElement | null>, autoFocus = false) => (
    <div className="relative flex items-center h-10 w-full rounded-full border border-hairline bg-card focus-within:border-ink-faint focus-within:shadow-[var(--shadow-card)] transition-colors">
      <Icon d={ICONS.search} className="w-4 h-4 ml-3.5 text-ink-faint shrink-0" />
      <input
        ref={ref}
        type="search"
        autoFocus={autoFocus}
        aria-label="Search products, makers and categories"
        value={searchQuery}
        onChange={(e) => updateSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            clearSearch();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Search products, makers, categories…"
        className="flex-1 min-w-0 bg-transparent px-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {searchQuery ? (
        <button type="button" onClick={clearSearch} className="mr-2 p-1 rounded-full text-ink-faint hover:text-ink" aria-label="Clear search">
          <Icon d={ICONS.close} className="w-4 h-4" />
        </button>
      ) : (
        <kbd className="hidden lg:inline-flex mr-2.5 px-1.5 py-0.5 rounded-md border border-hairline text-[10px] font-mono text-ink-faint">⌘K</kbd>
      )}
    </div>
  );

  /* ─────────── search results (replaces page content while typing) ─────────── */
  const searchView = (
    <section aria-labelledby="search-heading" className="space-y-6">
      <div className="flex items-end justify-between gap-3 border-b border-hairline pb-3">
        <div className="min-w-0">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">Search</p>
          <h1 id="search-heading" className="text-xl sm:text-2xl font-semibold tracking-tight text-ink truncate">
            “{searchQuery.trim()}”
          </h1>
        </div>
        <button
          type="button"
          onClick={clearSearch}
          className="shrink-0 h-9 px-3 rounded-full border border-hairline text-xs font-medium text-ink-dim hover:text-ink hover:bg-surface"
        >
          Clear
        </button>
      </div>

      {isSearching && (
        <div className="space-y-2" aria-live="polite">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-[var(--radius-card)] bg-surface animate-pulse" />
          ))}
        </div>
      )}

      {!isSearching && searchResults.products.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-wider text-ink-faint">
            Products · {searchResults.products.length}
          </h2>
          <ul className="space-y-2">
            {searchResults.products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/product/${p.slug || slugify(p.name)}`}
                  onClick={clearSearch}
                  className="flex items-center gap-3.5 p-3 rounded-[var(--radius-card)] border border-hairline bg-card hover:border-ink-faint hover:shadow-[var(--shadow-lift)] transition-all"
                >
                  <Avatar src={p.logoUrl} name={p.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink truncate">{p.name}</div>
                    <div className="text-sm text-ink-dim truncate">{p.tagline}</div>
                  </div>
                  <span className="hidden sm:inline text-xs px-2 py-1 rounded-full bg-surface text-ink-dim">{p.category}</span>
                  <span className="text-sm font-mono font-semibold text-ink tabular-nums">▲ {p.votes}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isSearching && searchResults.founders.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-wider text-ink-faint">
            Founders · {searchResults.founders.length}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {searchResults.founders.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/founder/${f.username}`}
                  onClick={clearSearch}
                  className="flex items-center gap-3 p-3 rounded-[var(--radius-card)] border border-hairline bg-card hover:border-ink-faint transition-colors"
                >
                  <Avatar src={f.image} name={f.name || f.username} size={40} round />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink truncate">{f.name}</div>
                    <div className="text-xs text-ink-dim truncate">
                      @{f.username} · {f.productsCount} shipped · {f.totalVotes} votes
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isSearching && searchResults.products.length === 0 && searchResults.founders.length === 0 && (
        <div className="py-16 text-center rounded-[var(--radius-card)] border border-dashed border-hairline">
          <p className="font-semibold text-ink">No matches for “{searchQuery.trim()}”</p>
          <p className="mt-1 text-sm text-ink-dim">Try a product name, a maker&apos;s @handle, or browse by category.</p>
          <Link href="/categories" onClick={clearSearch} className="inline-block mt-4 text-sm font-semibold text-signal hover:underline">
            Browse all categories →
          </Link>
        </div>
      )}
    </section>
  );

  /* ─────────── rails ─────────── */
  const leftRail = leftSidebar ?? (
    <nav aria-label="Top products by category" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono uppercase tracking-wider text-ink-faint">Top by category</h2>
        <div role="tablist" aria-label="Timeframe" className="flex p-0.5 rounded-full bg-surface border border-hairline text-[11px] font-medium">
          {(["weekly", "monthly"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={railTab === t}
              onClick={() => setRailTab(t)}
              className={`px-2.5 py-1 rounded-full transition-colors ${railTab === t ? "bg-card text-ink shadow-[var(--shadow-card)]" : "text-ink-dim hover:text-ink"}`}
            >
              {t === "weekly" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>

      {isLoadingLayout && railGroups.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface animate-pulse" />
          ))}
        </div>
      ) : railGroups.length > 0 ? (
        railGroups.map((group) => (
          <div key={group.name} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h3 className="text-[13px] font-semibold text-ink truncate">{group.name}</h3>
              <Link href={`/category/${group.slug}`} className="shrink-0 text-[11px] font-medium text-signal hover:underline">
                All
              </Link>
            </div>
            <ol className="space-y-0.5">
              {group.top.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/product/${p.slug || slugify(p.name)}`}
                    className="group flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-surface transition-colors"
                  >
                    <span className={`w-4 text-center font-mono text-[11px] ${i === 0 ? "text-signal font-bold" : "text-ink-faint"}`}>{i + 1}</span>
                    <Avatar src={p.logoUrl} name={p.name} size={24} />
                    <span className="flex-1 min-w-0 text-[13px] text-ink truncate group-hover:text-signal">{p.name}</span>
                    <span className="font-mono text-[11px] text-ink-faint tabular-nums">▲{p.votes}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))
      ) : (
        <div className="p-4 rounded-[var(--radius-card)] border border-dashed border-hairline text-center space-y-2">
          <p className="text-sm font-medium text-ink">No launches this {railTab === "weekly" ? "week" : "month"} yet</p>
          <Link href="/submit" className="inline-block text-xs font-semibold text-signal hover:underline">
            Be the first to launch →
          </Link>
        </div>
      )}
    </nav>
  );

  const spotlightBlock =
    spotlight.length > 0 ? (
      <section aria-labelledby="spotlight-heading" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="spotlight-heading" className="text-xs font-mono uppercase tracking-wider text-ink-faint">
            Spotlight
          </h2>
          <Link href="/submit" className="text-[11px] text-ink-faint hover:text-signal">
            Sponsored · Get yours
          </Link>
        </div>
        <ul className={`space-y-1.5 transition-opacity duration-300 ${isFading ? "opacity-0" : "opacity-100"}`}>
          {spotlight.map((p, i) => (
            <li key={`${p.id}-${i}`}>
              <SlotLink
                slot={p}
                src="spotlight"
                className="flex items-center gap-3 p-2.5 rounded-xl border border-hairline bg-card hover:border-signal/50 hover:shadow-[var(--shadow-lift)] transition-all"
              >
                <Avatar src={p.logoUrl} name={p.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink truncate">{p.name}</div>
                  <div className="text-xs text-ink-dim truncate">{p.tagline}</div>
                </div>
              </SlotLink>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  const rightRail = (
    <div className="space-y-6">
      {spotlightBlock}
      <section className="space-y-3">
        <div role="tablist" aria-label="Browse" className="flex p-0.5 rounded-full bg-surface border border-hairline text-xs font-medium">
          {(["categories", "founders"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={rightRailTab === t}
              onClick={() => setRightRailTab(t)}
              className={`flex-1 px-3 py-1.5 rounded-full transition-colors ${rightRailTab === t ? "bg-card text-ink shadow-[var(--shadow-card)]" : "text-ink-dim hover:text-ink"}`}
            >
              {t === "categories" ? "Categories" : "Top founders"}
            </button>
          ))}
        </div>
        {rightRailTab === "categories" ? (
          <ul className="space-y-0.5">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/category/${c.slug}`}
                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                    pathname === `/category/${c.slug}` ? "bg-signal-dim text-signal font-semibold" : "text-ink hover:bg-surface"
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  {typeof c.productCount === "number" && (
                    <span className="font-mono text-[11px] text-ink-faint tabular-nums">{c.productCount}</span>
                  )}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/categories" className="block px-2.5 py-2 text-xs font-semibold text-signal hover:underline">
                All categories →
              </Link>
            </li>
          </ul>
        ) : (
          <ol className="space-y-0.5">
            {isLoadingLayout && topFounders.length === 0
              ? Array.from({ length: 8 }).map((_, i) => <li key={i} className="h-10 rounded-lg bg-surface animate-pulse" />)
              : topFounders.slice(0, 25).map((f, i) => (
                  <li key={f.id || f.username}>
                    <Link href={`/founder/${f.username}`} className="group flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-surface transition-colors">
                      <span className={`w-5 text-center font-mono text-[11px] ${i < 3 ? "text-signal font-bold" : "text-ink-faint"}`}>{i + 1}</span>
                      <Avatar src={f.image} name={f.name || f.username} size={26} round />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] text-ink truncate group-hover:text-signal">{f.name || f.username}</span>
                        <span className="block text-[11px] text-ink-faint truncate">@{f.username}</span>
                      </span>
                      <span className="font-mono text-[11px] text-ink-faint tabular-nums">
                        {f.totalVotes ? `▲${f.totalVotes}` : `${f.productsCount || 0}`}
                      </span>
                    </Link>
                  </li>
                ))}
            <li>
              <Link href="/founders" className="block px-2.5 py-2 text-xs font-semibold text-signal hover:underline">
                Top 100 founders →
              </Link>
            </li>
          </ol>
        )}
      </section>
    </div>
  );

  /* ─────────── render ─────────── */
  return (
    <div className="min-h-dvh flex flex-col bg-void text-ink" style={{ ["--tlf-header-h" as string]: `${headerH}px` }}>
      {/* Featured strip + header are pinned together, so paid Featured slots
          stay visible while scrolling. --tlf-header-h covers both. */}
      <div className="sticky top-0 z-40">
      {showFeatured && (
        <div className="tlf-ticker relative h-10 overflow-hidden" aria-label="Featured products">
          <div className="flex items-stretch h-full">
            {/* "On air" tab */}
            <span className="tlf-ticker-tab relative z-10 shrink-0 flex items-center gap-2 pl-3 sm:pl-4 pr-6 font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
              <span className="tlf-live-dot w-1.5 h-1.5 rounded-full bg-white" aria-hidden />
              <span className="hidden sm:inline">Featured</span>
              <span className="sm:hidden">Live</span>
            </span>
            <div className="tlf-ticker-viewport marquee-container flex overflow-hidden flex-1 -ml-3">
              {[0, 1].map((track) => (
                <ul
                  key={track}
                  className="marquee-track flex shrink-0 items-center h-10"
                  aria-hidden={track === 1 ? "true" : undefined}
                  // Full names + taglines make entries wide; scale the loop so the
                  // ticker keeps a calm, readable pace (~9s per product).
                  style={{ animationDuration: `${Math.max(40, featured.length * 2 * 9)}s` }}
                >
                  {[...featured, ...featured].map((p, i) => (
                    <li key={`${track}-${i}`} className="flex items-center shrink-0">
                      <SlotLink
                        slot={p}
                        src="featured"
                        tabIndex={track === 1 ? -1 : undefined}
                        className="tlf-ticker-item group flex w-max items-center gap-2.5 h-10 px-4 whitespace-nowrap"
                      >
                        <Avatar src={p.logoUrl} name={p.name} size={20} />
                        <span className="tlf-ticker-name font-display font-black text-[13px] uppercase tracking-wider">{p.name}</span>
                        {p.tagline && <span className="tlf-ticker-tagline text-xs">{p.tagline}</span>}
                        <svg className="tlf-ticker-arrow w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
                          <path strokeLinecap="square" d="M7 17 17 7M9 7h8v8" />
                        </svg>
                      </SlotLink>
                      <span className="tlf-ticker-sep h-4 w-px" aria-hidden />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Site header */}
      <header className="relative h-[60px] border-b border-hairline bg-void/85 backdrop-blur-xl supports-[backdrop-filter]:bg-void/75">
        <div className="mx-auto h-full max-w-[1600px] px-4 lg:px-6 flex items-center gap-3 lg:gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="The Launch Feed — home">
            <LaunchFeedLogo size={22} />
            <span className="font-display font-black text-[15px] sm:text-[17px] tracking-wide text-ink uppercase leading-none whitespace-nowrap">
              The Launch <span className="text-signal">Feed</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden lg:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    active ? "text-ink bg-surface" : "text-ink-dim hover:text-ink hover:bg-surface/70"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Full search box from xl; below that the icon opens the search sheet so the
              nav, Submit and profile buttons never get pushed off-screen. */}
          <div className="hidden xl:block flex-1 min-w-0 max-w-md ml-auto">{searchField(inputRef)}</div>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto xl:ml-0 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen((v) => !v);
                setTimeout(() => mobileInputRef.current?.focus(), 30);
              }}
              className="xl:hidden w-10 h-10 flex items-center justify-center rounded-full text-ink-dim hover:text-ink hover:bg-surface"
              aria-label="Search"
              aria-expanded={mobileSearchOpen}
            >
              <Icon d={ICONS.search} />
            </button>
            <NextBatchPill />
            <LaunchButton />
            {userSession ? (
              <Link
                href="/profile"
                // A centred circle around the avatar; it only widens into a
                // pill on 2xl screens, where the handle is shown beside it.
                className="hidden sm:flex items-center justify-center w-10 h-10 2xl:w-auto 2xl:justify-start 2xl:gap-2 2xl:pl-[3px] 2xl:pr-3 rounded-full border border-hairline bg-card hover:border-signal/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 transition-colors"
                title={`${userSession.name}'s dashboard`}
                aria-label="Your dashboard"
              >
                <Avatar src={userSession.image} name={userSession.name || userSession.handle || "Me"} size={32} round />
                <span className="hidden 2xl:inline text-sm font-medium text-ink max-w-[120px] truncate">{userSession.handle}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center h-10 px-4 rounded-full border border-hairline text-sm font-medium text-ink hover:bg-surface transition-colors"
              >
                Log in
              </Link>
            )}
          </div>
        </div>

        {/* Mobile search sheet */}
        {mobileSearchOpen && (
          <div className="xl:hidden absolute inset-x-0 top-full border-b border-hairline bg-void px-4 py-3 shadow-[var(--shadow-lift)]">
            {searchField(mobileInputRef, true)}
          </div>
        )}
      </header>
      </div>

      {/* Body */}
      <div className="flex-1 w-full mx-auto max-w-[1600px] px-4 lg:px-6">
        {rails ? (
          <div className="xl:grid xl:grid-cols-[240px_minmax(0,1fr)_280px] 2xl:grid-cols-[260px_minmax(0,1fr)_300px] xl:gap-8">
            <aside className="hidden xl:block pb-14">
              <div className="tlf-rail overflow-y-auto no-scrollbar pt-6 pb-10 pr-1">{leftRail}</div>
            </aside>

            <main id="main" className="tlf-main min-w-0 pt-5 sm:pt-6 pb-10 tlf-safe-bottom xl:pb-14">
              {/* Mobile / tablet spotlight — one fixed row, rotates every 15s. */}
              {!searching && rotating.length > 0 && <MobileSpotlight slots={rotating} />}
              {searching ? searchView : children}
            </main>

            <aside className="hidden xl:block pb-14" aria-label="Spotlight and browse">
              <div className="tlf-rail overflow-y-auto no-scrollbar pt-6 pb-10 pl-1">{rightRail}</div>
            </aside>
          </div>
        ) : (
          <main id="main" className="tlf-main min-w-0 pt-6 sm:pt-10 pb-12 tlf-safe-bottom xl:pb-16">
            {searching ? <div className="max-w-3xl mx-auto">{searchView}</div> : children}
          </main>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-hairline bg-surface/40 tlf-safe-bottom">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-6 pt-10 pb-12 space-y-10">
          {/* Launch call-to-action */}
          <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-card shadow-card px-5 py-6 sm:px-8 sm:py-7 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full bg-signal/10 blur-3xl" />
            <div className="relative space-y-1.5 max-w-2xl">
              <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-signal">Launching something?</p>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink">
                Put it in front of makers at the next 6:00 AM IST batch.
              </h2>
              <p className="text-sm text-ink-dim leading-relaxed">
                Free launches earn a dofollow backlink and a shot at the daily, weekly and monthly boards. Paid launches add a
                30-day spotlight.
              </p>
            </div>
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
              <NextLaunchCountdown variant="compact" />
              <div className="flex items-center gap-2">
                <Link
                  href="/submit"
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-signal text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <SignalMatrix size={14} />
                  Launch your product
                </Link>
                <Link
                  href="/leaderboard/weekly"
                  className="inline-flex items-center h-10 px-4 rounded-full border border-hairline bg-card text-sm font-medium text-ink hover:border-ink-faint transition-colors"
                >
                  This week&apos;s best
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-8 gap-y-10">
            <div className="col-span-2 space-y-4">
              <Link href="/" className="inline-flex items-center gap-2" aria-label="The Launch Feed — home">
                <LaunchFeedLogo size={22} />
                <span className="font-display font-black text-lg tracking-wide uppercase text-ink">
                  The Launch <span className="text-signal">Feed</span>
                </span>
              </Link>
              <p className="text-sm text-ink-dim leading-relaxed max-w-sm">
                The daily leaderboard for new software and AI products. Founders launch free, the community votes, and
                the best tools graduate to the weekly, monthly and all-time boards.
              </p>
              <p className="text-xs font-mono text-signal font-semibold">ship. vote. rise.</p>
              <div className="flex items-center gap-2">
                {[
                  { href: "https://x.com/thelaunchfeed", label: "X (Twitter)", d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z", fill: true },
                  { href: "https://bsky.app/profile/thelaunchfeed.bsky.social", label: "Bluesky", d: "M12 10.8c-1.1-2.1-4-6-6.7-7.9C2.7 1 1.7 1.3 1 1.6.3 2 .2 3.1.2 3.7s.4 5.3.6 6.1c.8 2.7 3.6 3.6 6.2 3.3-3.8.6-7.2 2-2.8 6.9 4.9 5 6.7-1.1 7.6-4.2.9 3.1 2 9 7.5 4.2 4.2-4.2 1.2-6.3-2.6-6.9 2.6.3 5.4-.6 6.2-3.3.2-.8.6-5.5.6-6.1s-.1-1.7-.8-2.1c-.7-.3-1.7-.6-4.3 1.3-2.7 1.9-5.6 5.8-6.7 7.9z", fill: true },
                  { href: "https://t.me/thelaunchfeed", label: "Telegram", d: "M21.5 4.5 2.8 11.7c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8L22.9 6c.3-1.3-.5-1.9-1.4-1.5zM8.8 14.4l9.6-6.1c.5-.3.9-.1.5.2l-8.2 7.4-.3 3.5z", fill: true },
                ].map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noopener"
                    aria-label={`The Launch Feed on ${s.label}`}
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-hairline bg-card text-ink-dim hover:text-ink hover:border-ink-faint transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                      <path d={s.d} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            <FooterColumn
              title="Leaderboards"
              links={[
                { href: "/", label: "Today's launches" },
                { href: "/leaderboard/weekly", label: "Best of the week" },
                { href: "/leaderboard/monthly", label: "Best of the month" },
                { href: "/leaderboard/yearly", label: `${new Date().getFullYear()} champions` },
                { href: "/leaderboard/all-time", label: "All-time hall of fame" },
              ]}
            />
            <FooterColumn
              title="Makers"
              links={[
                { href: "/submit", label: "Launch your product" },
                { href: "/badges", label: "Winner badges" },
                { href: "/founders", label: "Top 100 founders" },
                { href: "/profile", label: "Maker dashboard" },
                { href: "/contact", label: "Advertise & spotlight" },
              ]}
            />
            <FooterColumn
              title="Discover"
              links={categories.slice(0, 5).map((c) => ({ href: `/category/${c.slug}`, label: c.name })).concat([
                { href: "/categories", label: "All categories" },
              ])}
            />
            <FooterColumn
              title="Company"
              links={[
                { href: "/about", label: "About" },
                { href: "/contact", label: "Contact" },
                { href: "/privacy", label: "Privacy" },
                { href: "/terms", label: "Terms" },
                { href: "/llms.txt", label: "llms.txt (for AI)", external: true },
                { href: "/feed.xml", label: "RSS feed", external: true },
              ]}
              extra={
                <button type="button" onClick={openCookieSettings} className="text-ink-dim hover:text-signal transition-colors">
                  Cookie preferences
                </button>
              }
            />
          </div>

          <FeaturedOnFooterBar />

          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-6 border-t border-hairline text-xs text-ink-faint">
            <p>© {new Date().getFullYear()} The Launch Feed. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <a href="https://x.com/menajulm" target="_blank" rel="noopener" className="flex items-center gap-2 hover:text-ink transition-colors">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/menajulm.avif" alt="" width={20} height={20} className="w-5 h-5 rounded-full object-cover" />
                Built by @menajulm
              </a>
              <div role="radiogroup" aria-label="Color theme" className="flex p-0.5 rounded-full border border-hairline bg-card">
                {(["light", "void", "thermal"] as ThemeMode[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={themeMode === t}
                    onClick={() => applyTheme(t)}
                    className={`px-2.5 py-1 rounded-full capitalize transition-colors ${themeMode === t ? "bg-ink text-void" : "text-ink-dim hover:text-ink"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile tab bar */}
      <nav
        aria-label="Mobile"
        className="xl:hidden fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-void/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto max-w-md grid grid-cols-5 h-16">
          <MobileTab href="/" label="Today" icon={ICONS.home} active={pathname === "/"} />
          <MobileTab href="/leaderboard/weekly" label="Top" icon={ICONS.trophy} active={pathname.startsWith("/leaderboard")} />
          <li className="flex items-center justify-center">
            <Link
              href="/submit"
              aria-label="Launch your product"
              className="tlf-launch tlf-launch-fab -mt-5 flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-2xl ring-4 ring-void"
            >
              <SignalMatrix size={18} />
              <span className="text-[10px] font-bold uppercase tracking-wide leading-none">Launch</span>
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
                setTimeout(() => mobileInputRef.current?.focus(), 60);
              }}
              className={`w-full h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${mobileSearchOpen ? "text-signal" : "text-ink-dim"}`}
            >
              <Icon d={ICONS.search} className="w-[22px] h-[22px]" />
              Search
            </button>
          </li>
          <MobileTab
            href={userSession ? "/profile" : "/login"}
            label={userSession ? "Me" : "Log in"}
            icon={ICONS.user}
            active={pathname.startsWith("/profile")}
          />
        </ul>
      </nav>
    </div>
  );
}

function FooterColumn({
  title,
  links,
  extra,
}: {
  title: string;
  links: Array<{ href: string; label: string; external?: boolean }>;
  extra?: React.ReactNode;
}) {
  const cls = "text-ink-dim hover:text-signal transition-colors";
  return (
    <nav aria-label={title} className="space-y-3.5">
      <h2 className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-ink">{title}</h2>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            {l.external ? (
              <a href={l.href} className={cls}>
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className={cls}>
                {l.label}
              </Link>
            )}
          </li>
        ))}
        {extra ? <li>{extra}</li> : null}
      </ul>
    </nav>
  );
}

function MobileTab({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`w-full h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-signal" : "text-ink-dim"}`}
      >
        <Icon d={icon} className="w-[22px] h-[22px]" />
        {label}
      </Link>
    </li>
  );
}
