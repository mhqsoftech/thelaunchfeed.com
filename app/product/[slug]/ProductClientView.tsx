"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import MainLayoutShell from "@/app/MainLayoutShell";
import VerifiedRevenueChart from "@/app/components/VerifiedRevenueChart";
import ProductComments from "@/app/components/ProductComments";
import EmbeddableAwardWidget, { type EmbedAwardId } from "@/app/components/EmbeddableAwardWidget";
import PrimaryCTA from "@/components/ui/PrimaryCTA";
import { slugify, getStoredSession, saveSession, UserSession, formatProductWebsiteUrl } from "@/app/data";
import { toggleVote, toggleBookmark } from "@/app/actions/interactions";
import { getAccoladeDetails, type AccoladeItem, type ProductAward } from "@/lib/awards";

function isValidHttpUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const s = rawUrl.trim();
  if (
    !s ||
    s === "#" ||
    s === "/" ||
    s.toLowerCase() === "null" ||
    s.toLowerCase() === "undefined" ||
    s.toLowerCase() === "n/a" ||
    s.toLowerCase() === "none" ||
    s.toLowerCase() === "none yet" ||
    s.toLowerCase() === "coming soon"
  ) {
    return false;
  }
  try {
    const formatted = s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`;
    const parsed = new URL(formatted);
    const host = parsed.hostname.toLowerCase();
    return Boolean(
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        host &&
        (host.includes(".") || host === "localhost") &&
        host.length >= 3 &&
        !host.startsWith(".") &&
        !host.endsWith(".")
    );
  } catch {
    return false;
  }
}

/** DB-shaped product view model — server component builds this in page.tsx. */
export type ViewProduct = {
  id: string;
  ownerId?: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  websiteUrl: string;
  logoUrl?: string | null;
  screenshots?: string[];
  videoUrl?: string | null;
  tags?: string[];
  category: string;
  launchedAt: string;
  updatedAt?: string | null;
  votes: number;
  maker: string;
  makerName: string;
  makerUsername?: string;
  makerImage: string | null;
  makerTitle?: string | null;
  makerBio?: string | null;
  makerTwitter?: string | null;
  makerGithub?: string | null;
  makerWebsite?: string | null;
  revenue: string;
  mrrCents?: number;
  totalRevenueCents?: number;
  revenueProvider?: string;
  isRevenueVerified?: boolean;
  dailyRank?: number | null;
  weeklyRank?: number | null;
  monthlyRank?: number | null;
  awards?: Array<{ label: string; style: string }>;
  rawAwards?: ProductAward[];
  accolades?: AccoladeItem[];
  details?: {
    overviewPitch?: string;
    features?: string[];
    feature1?: string;
    feature2?: string;
    feature3?: string;
    pricingTiers?: Array<{ name: string; price: string; specs: string }>;
    freePlan?: string;
    proPlan?: string;
    enterprisePlan?: string;
    techStack?: string;
    infraHosting?: string;
    apiUrl?: string;
    securityStandards?: string;
    targetAudience?: string;
    originStory?: string;
    makerThesis?: string;
    latestVersion?: string;
    latestChangelog?: string;
    roadmapQ3?: string;
    roadmapQ4?: string;
    pricingPartner?: string;
    revenue?: string;
    apiKey?: string;
    faqs?: Array<{ q: string; a: string }>;
    faq1Q?: string;
    faq1A?: string;
    faq2Q?: string;
    faq2A?: string;
    supportEmail?: string;
    githubUrl?: string;
  } | null;
};



const SAMPLE_MEDIA_ITEMS = [
  {
    id: 1,
    title: "Dashboard Overview",
    subtitle: "Realtime analytics & code review telemetry",
  },
  {
    id: 2,
    title: "Architecture Map",
    subtitle: "Automatic repository dependency visualization",
  },
  {
    id: 3,
    title: "CI/CD Pipeline Integration",
    subtitle: "Zero-latency automated security checks",
  },
];

function formatPitchParagraphs(text: string | undefined | null): string[] {
  if (!text || !text.trim()) return [];
  const trimmed = text.trim();
  const doubleNewlineSplit = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (doubleNewlineSplit.length > 1) return doubleNewlineSplit;

  const singleNewlineSplit = trimmed.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  if (singleNewlineSplit.length > 1) return singleNewlineSplit;

  const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [trimmed];
  if (sentences.length <= 3) return [trimmed];

  const paragraphs: string[] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    currentChunk.push(sentences[i].trim());
    if (currentChunk.length >= 3 || i === sentences.length - 1) {
      paragraphs.push(currentChunk.join(" "));
      currentChunk = [];
    }
  }

  return paragraphs;
}

function renderVideoEmbed(url: string) {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (ytMatch) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${ytMatch[1]}`}
        title="Product Video Demo"
        className="w-full aspect-video rounded-xs border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (loomMatch) {
    return (
      <iframe
        src={`https://www.loom.com/embed/${loomMatch[1]}`}
        title="Product Video Walkthrough"
        className="w-full aspect-video rounded-xs border-0"
        allowFullScreen
      />
    );
  }
  const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/);
  if (vimeoMatch) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
        title="Product Video Demo"
        className="w-full aspect-video rounded-xs border-0"
        allowFullScreen
      />
    );
  }
  return (
    <video
      src={url}
      controls
      className="w-full aspect-video rounded-xs object-contain bg-black"
    />
  );
}

export interface SimilarProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoUrl?: string | null;
  voteCount: number;
  categoryName: string;
  maker?: string;
  mrr?: string | null;
}

export default function ProductClientView({
  slug: _slug,
  product: baseProduct,
  initialHasVoted = false,
  initialIsSaved = false,
  isOwner = false,
  similarProducts = [],
  initialComments = [],
}: {
  slug: string;
  product: ViewProduct;
  initialHasVoted?: boolean;
  initialIsSaved?: boolean;
  isOwner?: boolean;
  similarProducts?: SimilarProduct[];
  initialComments?: any[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [product] = useState(baseProduct);
  const similarScrollRef = useRef<HTMLDivElement>(null);

  const scrollSimilar = (direction: "left" | "right") => {
    if (!similarScrollRef.current) return;
    const scrollAmount = direction === "left" ? -320 : 320;
    similarScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const [upvotes, setUpvotes] = useState(baseProduct.votes);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [copiedShare, setCopiedShare] = useState(false);
  
  const galleryItems = React.useMemo(() => {
    if (baseProduct.screenshots && baseProduct.screenshots.length > 0) {
      return baseProduct.screenshots.map((url, idx) => ({
        id: idx + 1,
        url,
        title: `Product Screenshot 0${idx + 1}`,
        subtitle: `UI Preview 0${idx + 1}`,
      }));
    }
    return SAMPLE_MEDIA_ITEMS.map((item) => ({ ...item, url: null }));
  }, [baseProduct.screenshots]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [userSession, setUserSession] = useState<UserSession | null>(null);

  const isFounder = React.useMemo(() => {
    if (isOwner) return true;
    if (!userSession) return false;
    // Check if session user ID matches product owner ID
    if (product.ownerId && userSession.id && userSession.id === product.ownerId) {
      return true;
    }
    // Check if user handle matches product maker handle
    const sessionHandle = (userSession.handle || "").toLowerCase().replace(/^@/, "").trim();
    const productHandle = (product.maker || "").toLowerCase().replace(/^@/, "").trim();
    if (sessionHandle && productHandle && sessionHandle === productHandle) {
      return true;
    }
    return false;
  }, [isOwner, userSession, product.ownerId, product.maker]);

  const eligibleAwards = React.useMemo<EmbedAwardId[]>(() => {
    const list: EmbedAwardId[] = ["launch"];
    if (product.rawAwards) {
      for (const a of product.rawAwards) {
        list.push(a as EmbedAwardId);
      }
    }
    if (product.dailyRank === 1) { list.push("daily_1"); list.push("pod"); }
    if (product.dailyRank === 2) list.push("daily_2");
    if (product.dailyRank === 3) list.push("daily_3");

    if (product.weeklyRank === 1) list.push("weekly_1");
    if (product.weeklyRank === 2) list.push("weekly_2");
    if (product.weeklyRank === 3) list.push("weekly_3");

    if (product.monthlyRank === 1) list.push("monthly_1");
    if (product.monthlyRank === 2) list.push("monthly_2");
    if (product.monthlyRank === 3) list.push("monthly_3");

    if (product.votes >= 100) { list.push("yearly_1"); list.push("champion"); }
    if (product.votes >= 50) list.push("alltime_1");
    if (product.revenue && product.revenue.trim().length > 0) list.push("revenue");
    if (product.votes >= 10) list.push("upvote");
    return Array.from(new Set(list));
  }, [product.rawAwards, product.dailyRank, product.weeklyRank, product.monthlyRank, product.votes, product.revenue]);

  const displayAccolades: AccoladeItem[] = React.useMemo(() => {
    if (product.accolades && product.accolades.length > 0) {
      return product.accolades;
    }
    const awardsList: ProductAward[] = product.rawAwards ? [...product.rawAwards] : ["launch"];
    if (product.dailyRank === 1) awardsList.push("daily_1");
    if (product.dailyRank === 2) awardsList.push("daily_2");
    if (product.dailyRank === 3) awardsList.push("daily_3");
    if (product.weeklyRank === 1) awardsList.push("weekly_1");
    if (product.weeklyRank === 2) awardsList.push("weekly_2");
    if (product.weeklyRank === 3) awardsList.push("weekly_3");
    if (product.monthlyRank === 1) awardsList.push("monthly_1");
    if (product.monthlyRank === 2) awardsList.push("monthly_2");
    if (product.monthlyRank === 3) awardsList.push("monthly_3");
    if (product.revenue) awardsList.push("revenue");
    if (product.votes >= 50) awardsList.push("upvote");
    return getAccoladeDetails(awardsList, product.slug, { revenueFormatted: product.revenue });
  }, [
    product.accolades,
    product.rawAwards,
    product.dailyRank,
    product.weeklyRank,
    product.monthlyRank,
    product.revenue,
    product.votes,
    product.slug,
  ]);

  const wonAccolades = React.useMemo(
    () => displayAccolades.filter((a) => a.id !== "launch"),
    [displayAccolades]
  );
  const topAccolade = wonAccolades[0] || null;

  useEffect(() => {
    document.title = `${baseProduct.name} - Product | The Launch Feed`;
    const s = getStoredSession();
    if (s) {
      setUserSession(s);
      if (Array.isArray(s.savedProductIds)) {
        setIsSaved(s.savedProductIds.includes(baseProduct.id));
      }
      if (Array.isArray(s.upvotedProductIds)) {
        setHasVoted(s.upvotedProductIds.includes(baseProduct.id));
      }
    }

    const handleAuthChange = (e: Event) => {
      const customEv = e as CustomEvent<UserSession | null>;
      const fresh = customEv.detail !== undefined ? customEv.detail : getStoredSession();
      setUserSession(fresh);
      if (fresh) {
        if (Array.isArray(fresh.savedProductIds)) {
          setIsSaved(fresh.savedProductIds.includes(baseProduct.id));
        }
        if (Array.isArray(fresh.upvotedProductIds)) {
          setHasVoted(fresh.upvotedProductIds.includes(baseProduct.id));
        }
      } else {
        setIsSaved(false);
        setHasVoted(false);
      }
    };
    window.addEventListener("authChanged", handleAuthChange);
    return () => window.removeEventListener("authChanged", handleAuthChange);
  }, [baseProduct.id, baseProduct.name, baseProduct.tagline]);

  const handleUpvote = async () => {
    const session = getStoredSession();
    if (!session) {
      router.push(`/handler/sign-in?after_auth_return_to=${encodeURIComponent(pathname)}`);
      return;
    }
    const optimistic = !hasVoted;
    setHasVoted(optimistic);
    setUpvotes((v) => v + (optimistic ? 1 : -1));

    // Update session cache optimistically
    const currentUpvoted = new Set(session.upvotedProductIds || []);
    if (optimistic) {
      currentUpvoted.add(baseProduct.id);
    } else {
      currentUpvoted.delete(baseProduct.id);
    }
    const updatedSession = { ...session, upvotedProductIds: Array.from(currentUpvoted) };
    saveSession(updatedSession);

    try {
      const res = await toggleVote(baseProduct.id);
      setHasVoted(res.voted);
      setUpvotes(res.voteCount);

      // Reconcile with server response
      const serverSet = new Set(updatedSession.upvotedProductIds);
      if (res.voted) {
        serverSet.add(baseProduct.id);
      } else {
        serverSet.delete(baseProduct.id);
      }
      saveSession({ ...session, upvotedProductIds: Array.from(serverSet) });
    } catch (err) {
      // Rollback on failure
      setHasVoted(!optimistic);
      setUpvotes((v) => v + (optimistic ? -1 : 1));
      saveSession(session);
      console.error("[vote] failed:", err);
    }
  };

  const handleBookmark = async () => {
    const session = getStoredSession();
    if (!session) {
      router.push(`/handler/sign-in?after_auth_return_to=${encodeURIComponent(pathname)}`);
      return;
    }
    const optimistic = !isSaved;
    setIsSaved(optimistic);

    // Update session cache optimistically
    const currentSaved = new Set(session.savedProductIds || []);
    if (optimistic) {
      currentSaved.add(baseProduct.id);
    } else {
      currentSaved.delete(baseProduct.id);
    }
    const updatedSession = { ...session, savedProductIds: Array.from(currentSaved) };
    saveSession(updatedSession);

    try {
      const res = await toggleBookmark(baseProduct.id);
      setIsSaved(res.saved);

      // Reconcile with server response
      const serverSet = new Set(updatedSession.savedProductIds);
      if (res.saved) {
        serverSet.add(baseProduct.id);
      } else {
        serverSet.delete(baseProduct.id);
      }
      saveSession({ ...session, savedProductIds: Array.from(serverSet) });
    } catch (err) {
      // Rollback on failure
      setIsSaved(!optimistic);
      saveSession(session);
      console.error("[bookmark] failed:", err);
    }
  };

  const d: Record<string, any> = {
    ...(product.details || {}),
    ...(product as any),
  };

  const mrrText =
    product.revenue ||
    (d.revenue && typeof d.revenue === "string" && !d.revenue.includes("Pre-Revenue") ? d.revenue : null) ||
    (d.apiKey ? "$14.2K / mo" : null);

  const pricingPartnerName = d.pricingPartner
    ? d.pricingPartner.charAt(0).toUpperCase() + d.pricingPartner.slice(1)
    : "Stripe";

  return (
    <MainLayoutShell>
      <div className="space-y-6 pb-12 font-mono text-ink max-w-full">
        {/* Navigation Breadcrumb Bar — Sticky & Pinned */}
        <div className="sticky -top-4 z-30 bg-void -mt-4 pt-4 border-b border-hairline shrink-0">
          <div className="h-10 flex items-center justify-between pb-2.5 gap-3">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono text-ink-dim overflow-x-auto no-scrollbar py-0.5 min-w-0">
              <Link
                href="/"
                className="hover:text-ink transition-colors flex items-center gap-1 shrink-0"
              >
                <span>Home</span>
              </Link>
              <span className="text-ink-faint shrink-0">/</span>
              <Link
                href={product.category ? `/category/${slugify(product.category)}` : "/"}
                className="hover:text-ink transition-colors shrink-0 uppercase text-[11px] font-bold"
              >
                {product.category || "Products"}
              </Link>
              <span className="text-ink-faint shrink-0">/</span>
              <span className="text-ink font-semibold truncate max-w-[160px] sm:max-w-[280px] md:max-w-none">
                {product.name}
              </span>
            </nav>

            <Link
              href="/"
              className="text-xs font-mono text-ink-dim hover:text-ink transition-colors hidden sm:flex items-center gap-1 shrink-0 text-[11px]"
            >
              ← Leaderboard
            </Link>
          </div>
        </div>

        {/* Product Hero Container (First Box) */}
        <div className="border border-hairline bg-surface/30 p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6">
            {/* Left: Logo & Core Info */}
            <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
              <div className="w-13 h-13 sm:w-16 sm:h-16 bg-surface border border-hairline shrink-0 flex items-center justify-center font-mono text-lg sm:text-xl font-bold text-ink overflow-hidden relative">
                {(product as any).logoUrl || (product as any).thumbnailAvif ? (
                  <img width="64" height="64"
                    src={((product as any).logoUrl || (product as any).thumbnailAvif) as string}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  product.name.substring(0, 2).toUpperCase()
                )}
              </div>

              <div className="space-y-1.5 min-w-0 flex-1">
                {/* Category & Won Awards Badges (Always visible on mobile & desktop) */}
                <div className="flex items-center gap-2 flex-wrap pb-0.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 border border-hairline text-ink-dim uppercase bg-surface/60 font-bold tracking-wider">
                    {product.category}
                  </span>

                  {/* All Won Accolades / Awards for this product */}
                  {wonAccolades.map((acc, aIdx) => (
                    isFounder ? (
                      <a
                        key={aIdx}
                        href={acc.downloadUrl}
                        download
                        title={`Official Award: ${acc.title} — Click to download vector badge asset`}
                        className={`text-[10px] font-mono px-2 py-0.5 border font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors ${acc.tone.border} ${acc.tone.text} ${acc.tone.bg}`}
                      >
                        <span>{acc.shortTag}</span>
                        <span className="text-[9px] opacity-70 leading-none">↓</span>
                      </a>
                    ) : (
                      <Link
                        key={aIdx}
                        href={`/badges/${product.slug}?award=${acc.badgeAwardParam}`}
                        title={`Official Award: ${acc.title}`}
                        className={`text-[10px] font-mono px-2 py-0.5 border font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${acc.tone.border} ${acc.tone.text} ${acc.tone.bg}`}
                      >
                        <span>{acc.shortTag}</span>
                      </Link>
                    )
                  ))}

                  {/* Verified MRR pill — only when revenue has actually been verified via a payment provider */}
                  {product.isRevenueVerified && product.revenue && !wonAccolades.some((a) => a.id === "revenue") && (
                    <span className="text-[10px] font-mono px-2 py-0.5 border border-signal/40 bg-void text-signal uppercase font-bold flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                      </svg>
                      Verified MRR {product.revenue}
                      {product.revenueProvider && (
                        <span className="text-ink-dim">· {product.revenueProvider}</span>
                      )}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-mono text-xl sm:text-2xl lg:text-3xl font-bold text-ink break-words leading-tight">
                    {product.name}
                  </h1>
                </div>

                <p className="font-mono text-xs sm:text-sm text-ink-dim max-w-2xl break-words leading-relaxed">
                  {product.tagline}
                </p>

                <address className="not-italic flex items-center gap-x-2 gap-y-1 pt-0.5 text-[11px] sm:text-xs font-mono text-ink-faint flex-wrap">
                  <span>Maker:</span>
                  <Link
                    href={`/founder/${product.makerUsername || slugify(product.makerName || product.maker)}`}
                    rel="author"
                    className="flex items-center gap-1.5 text-ink hover:underline font-medium hover:text-signal transition-colors group"
                  >
                    <span className="w-4 h-4 rounded-xs bg-surface border border-hairline flex items-center justify-center font-mono text-[8px] font-bold text-ink-dim overflow-hidden relative shrink-0">
                      {product.makerImage ? (
                        <img width="64" height="64" src={product.makerImage} alt={product.makerName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        product.makerName.substring(0, 2).toUpperCase()
                      )}
                    </span>
                    <span>{product.makerName} ({product.maker})</span>
                  </Link>
                  <span>·</span>
                  <span>
                    Launched{" "}
                    <time dateTime={product.launchedAt}>{product.launchedAt}</time>
                  </span>
                  {product.updatedAt && product.updatedAt !== product.launchedAt && (
                    <>
                      <span>·</span>
                      <span>
                        Updated{" "}
                        <time dateTime={product.updatedAt}>{product.updatedAt.slice(0, 10)}</time>
                      </span>
                    </>
                  )}
                </address>
              </div>
            </div>

            {/* Right: Upvote & Save Actions (Stacked on Desktop, Side-by-Side on Mobile with Equal Widths) */}
            <div className="flex flex-row sm:flex-col items-stretch gap-2 shrink-0 w-full sm:w-36">
              <button
                onClick={handleUpvote}
                className={`flex-1 sm:flex-none h-9 px-3 border text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 uppercase tracking-wider ${
                  hasVoted
                    ? "border-signal bg-signal text-void shadow-xs"
                    : "border-hairline hover:border-ink bg-void text-ink hover:bg-surface/50"
                }`}
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M5 15l7-7 7 7" />
                </svg>
                <span>{hasVoted ? "Upvoted" : "Upvote"}</span>
                <span className="font-mono text-xs opacity-90 pl-1 border-l border-current/30">
                  {upvotes.toLocaleString()}
                </span>
              </button>

              <button
                onClick={handleBookmark}
                type="button"
                title={isSaved ? "Remove Bookmark" : "Save Product"}
                className={`flex-1 sm:flex-none h-9 px-3 border text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 uppercase font-bold tracking-wider ${
                  isSaved
                    ? "border-signal bg-void text-signal font-bold"
                    : "border-hairline bg-void text-ink-dim hover:text-ink hover:border-ink"
                }`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M3 2H13V14L8 10.5L3 14V2Z"
                    fill={isSaved ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="miter"
                    strokeLinecap="square"
                  />
                </svg>
                <span>{isSaved ? "Saved" : "Save"}</span>
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-hairline">
            <div className="flex items-center gap-2.5 flex-wrap">
              <a
                href={formatProductWebsiteUrl((product as any).websiteUrl || (product as any).website || `https://${slugify(product.name)}.com`)}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-4 py-2 border border-signal bg-signal/10 hover:bg-signal text-signal hover:text-void font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center shrink-0 uppercase tracking-wider group cursor-pointer"
              >
                <span>Visit Website</span>
                <span className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
              </a>

              {d.githubUrl && (
                <a
                  href={d.githubUrl.startsWith("http") ? d.githubUrl : `https://${d.githubUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-4 py-2 border border-hairline hover:border-ink bg-void hover:bg-surface text-ink font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center shrink-0 uppercase tracking-wider group cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>Source Code</span>
                  <span className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                </a>
              )}

              {d.apiUrl && (
                isValidHttpUrl(d.apiUrl) ? (
                  <a
                    href={d.apiUrl.startsWith("http") ? d.apiUrl : `https://${d.apiUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-4 py-2 border border-hairline hover:border-ink bg-void hover:bg-surface text-ink font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center shrink-0 uppercase tracking-wider group cursor-pointer"
                  >
                    <span>API Docs</span>
                    <span className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="API Docs link is not a valid URL"
                    className="w-full sm:w-auto px-4 py-2 border border-hairline/60 bg-surface/25 text-ink-dim/40 font-mono text-xs font-bold flex items-center justify-center gap-1.5 text-center shrink-0 uppercase tracking-wider cursor-not-allowed opacity-50 select-none pointer-events-none"
                  >
                    <span>API Docs</span>
                    <span className="text-[10px] text-ink-dim/40">✕</span>
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: product.name, url: window.location.href }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    setCopiedShare(true);
                    setTimeout(() => setCopiedShare(false), 2000);
                  }
                }}
                className={`w-full sm:w-auto px-4 py-2 border font-mono text-xs font-bold transition-all cursor-pointer text-center justify-center flex items-center gap-1.5 shrink-0 uppercase tracking-wider group ${
                  copiedShare
                    ? "border-signal text-signal bg-signal/10"
                    : "border-hairline hover:border-ink bg-void hover:bg-surface text-ink"
                }`}
              >
                <span>{copiedShare ? "Link Copied ✓" : "Share"}</span>
                <span className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-ink-dim group-hover:text-ink">↗</span>
              </button>
            </div>

            {/* Product Tags in Action Row Right Corner */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end">
                {product.tags.slice(0, 6).map((tag, tIdx) => (
                  <span
                    key={tIdx}
                    className="text-[10px] font-mono px-1.5 py-0.5 border border-hairline/60 text-ink-faint uppercase bg-surface/30 hover:border-ink-dim hover:text-ink-dim transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Video Demo & Walkthrough Section */}
        {product.videoUrl && (
          <div className="border border-hairline bg-surface/30 p-4 sm:p-6 space-y-3 max-w-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-hairline pb-2">
              <h2 className="font-mono text-xs sm:text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                <span>Product Video Demo &amp; Walkthrough</span>
              </h2>
              <a
                href={product.videoUrl.startsWith("http") ? product.videoUrl : `https://${product.videoUrl}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-mono text-signal hover:underline"
              >
                Open Original ↗
              </a>
            </div>
            <div className="overflow-hidden rounded-xs border border-hairline bg-black">
              {renderVideoEmbed(product.videoUrl)}
            </div>
          </div>
        )}

        {/* Horizontally Scrollable Product Media Gallery */}
        <div className="space-y-3 max-w-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-hairline pb-2">
            <h2 className="font-mono text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <span>Product Gallery</span>
              <span className="text-[10px] font-mono text-ink-faint font-normal">
                ({galleryItems.length} Images)
              </span>
            </h2>
          </div>

          <div className={`${galleryItems.length === 1 ? "w-full" : "overflow-x-auto no-scrollbar flex gap-3 sm:gap-4 snap-x"} py-1 max-w-full`}>
            {galleryItems.map((img) => (
              <div
                key={img.id}
                onClick={() => setSelectedImage(img.url || img.title)}
                className={`${galleryItems.length === 1 ? "w-full aspect-video" : "snap-start shrink-0 w-[240px] sm:w-[320px] h-[170px] sm:h-[190px]"} border border-hairline bg-surface p-2 flex flex-col justify-between cursor-pointer hover:border-ink transition-all relative group overflow-hidden`}
              >
                {img.url ? (
                  <img width="64" height="64" src={img.url} alt={img.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="flex items-center justify-between text-ink-faint text-xs font-mono">
                      <span>SHOT 0{img.id}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-signal">
                        Zoom ↗
                      </span>
                    </div>
                    <div className="space-y-1 my-auto min-w-0">
                      <div className="font-mono text-xs sm:text-sm font-bold text-ink truncate">
                        {img.title}
                      </div>
                      <div className="font-mono text-[11px] sm:text-xs text-ink-dim truncate">
                        {img.subtitle}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Verified Revenue Line Chart — only when the founder has verified this product's revenue */}
        {product.isRevenueVerified && product.revenue && (
          <VerifiedRevenueChart
            revenueFormatted={product.revenue}
            mrrCents={product.mrrCents}
            totalRevenueCents={product.totalRevenueCents}
            providerName={product.revenueProvider || "Stripe"}
          />
        )}

        {/* 360° PRODUCT INTELLIGENCE SUITE */}
        {(() => {
          const featuresList: string[] = d.features && Array.isArray(d.features) && d.features.length > 0
            ? d.features.filter((f: string) => typeof f === "string" && f.trim().length > 0)
            : [d.feature1, d.feature2, d.feature3].filter((f: string) => typeof f === "string" && f.trim().length > 0);

          const rawPitch = d.overviewPitch || d.description || "";
          const pitchParagraphs = formatPitchParagraphs(rawPitch);
          const hasOverviewPitch = pitchParagraphs.length > 0;
          const hasFeatures = featuresList.length > 0;
          const hasTargetAudience = Boolean((d.targetAudience || "").trim());
          const pricingTiersList: Array<{ name: string; price: string; specs: string }> =
            Array.isArray(d.pricingTiers) && d.pricingTiers.length > 0
              ? d.pricingTiers.filter((t: any) => (t.name || "").trim() || (t.price || "").trim() || (t.specs || "").trim())
              : [];
          const hasCustomPricing = pricingTiersList.length > 0;
          const hasPlans = Boolean(
            hasCustomPricing || (d.freePlan || "").trim() || (d.proPlan || "").trim() || (d.enterprisePlan || "").trim()
          );
          const showSection01 = hasOverviewPitch || hasFeatures || hasTargetAudience || hasPlans;

          const techStackList = (d.techStack || "").split(",").map((s: string) => s.trim()).filter(Boolean);
          const hasTechStack = techStackList.length > 0;
          const hasInfra = Boolean((d.infraHosting || "").trim());
          const hasSecurity = Boolean((d.securityStandards || "").trim());
          const hasApiUrl = Boolean((d.apiUrl || "").trim());
          const hasGithubUrl = Boolean((d.githubUrl || "").trim());
          const showArchitecture = hasTechStack || hasInfra || hasSecurity || hasApiUrl || hasGithubUrl;

          const hasOriginStory = Boolean((d.originStory || "").trim());
          const hasMakerThesis = Boolean((d.makerThesis || "").trim());
          const showStory = hasOriginStory || hasMakerThesis;

          const hasLatestVersion = Boolean((d.latestVersion || "").trim());
          const hasLatestChangelog = Boolean((d.latestChangelog || "").trim());
          const hasChangelog = hasLatestVersion || hasLatestChangelog;
          const hasRoadmap = Boolean((d.roadmapQ3 || "").trim() || (d.roadmapQ4 || "").trim());
          const showChangelog = hasChangelog || hasRoadmap;

          const faqsList: Array<{ q: string; a: string }> = Array.isArray(d.faqs) && d.faqs.length > 0
            ? d.faqs.filter((f: any) => (f.q || "").trim() || (f.a || "").trim())
            : [
                d.faq1Q && d.faq1A ? { q: d.faq1Q, a: d.faq1A } : null,
                d.faq2Q && d.faq2A ? { q: d.faq2Q, a: d.faq2A } : null,
              ].filter(Boolean) as Array<{ q: string; a: string }>;
          const hasFaqs = faqsList.length > 0;
          const hasSupportEmail = Boolean((d.supportEmail || "").trim());
          const showFaqSupport = hasFaqs || hasSupportEmail;

          const visibleSections: Array<{ id: string; title: string; content: React.ReactNode }> = [];

          if (showSection01) {
            visibleSections.push({
              id: "overview",
              title: "Overview & Pitch Details",
              content: (
                <div className="space-y-4 leading-relaxed">
                  {hasOverviewPitch && (
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-ink uppercase">Executive Pitch Summary</h3>
                      <div className="space-y-3 text-ink-dim leading-relaxed whitespace-pre-line break-words font-sans text-xs sm:text-sm">
                        {pitchParagraphs.map((para: string, idx: number) => (
                          <p key={idx} className="leading-relaxed">
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasFeatures && (
                    <div className={`space-y-1.5 ${hasOverviewPitch ? "pt-3 border-t border-hairline" : ""}`}>
                      <h3 className="font-bold text-ink uppercase font-mono text-xs">Core Value Propositions</h3>
                      <ul className="space-y-1.5 text-ink-dim font-mono text-xs">
                        {featuresList.map((f: string, i: number) => (
                          <li key={i} className="break-words">· {f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {hasTargetAudience && (
                    <div className="space-y-1.5 pt-3 border-t border-hairline font-mono text-xs">
                      <h3 className="font-bold text-ink uppercase">Target Audience &amp; ICP</h3>
                      <div className="space-y-2 text-ink-dim leading-relaxed whitespace-pre-line break-words">
                        {d.targetAudience.split(/\n\s*\n/).map((para: string, idx: number) => (
                          <p key={idx} className="leading-relaxed">{para.trim()}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasPlans && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-hairline font-mono text-xs">
                      {hasCustomPricing ? (
                        pricingTiersList.map((tier: any, tIdx: number) => (
                          <div key={tIdx} className="p-3 border border-hairline bg-surface/20 space-y-1">
                            <h4 className="font-bold uppercase text-[10px] text-ink">{tier.name || `Tier ${tIdx + 1}`}</h4>
                            <p className="font-bold text-sm text-ink">{tier.price || "—"}</p>
                            <p className="text-ink-dim text-[11px] leading-relaxed">{tier.specs || "—"}</p>
                          </div>
                        ))
                      ) : (
                        <>
                          {d.freePlan && (
                            <div className="p-3 border border-hairline bg-surface/20 space-y-1">
                              <h4 className="font-bold uppercase text-[10px] text-ink">Free Tier</h4>
                              <p className="font-bold text-sm text-ink">$0/mo</p>
                              <p className="text-ink-dim text-[11px] leading-relaxed">{d.freePlan}</p>
                            </div>
                          )}
                          {d.proPlan && (
                            <div className="p-3 border border-ink bg-surface/50 space-y-1">
                              <h4 className="font-bold uppercase text-[10px] text-signal">Pro Tier</h4>
                              <p className="font-bold text-sm text-signal">$29/mo</p>
                              <p className="text-ink-dim text-[11px] leading-relaxed">{d.proPlan}</p>
                            </div>
                          )}
                          {d.enterprisePlan && (
                            <div className="p-3 border border-hairline bg-surface/20 space-y-1">
                              <h4 className="font-bold uppercase text-[10px] text-ink">Enterprise</h4>
                              <p className="font-bold text-sm text-ink">$199/mo</p>
                              <p className="text-ink-dim text-[11px] leading-relaxed">{d.enterprisePlan}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ),
            });
          }

          if (showArchitecture) {
            visibleSections.push({
              id: "architecture",
              title: "Architecture & Technical Specs",
              content: (
                <div className="space-y-4 leading-relaxed font-mono text-xs">
                  {hasTechStack && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-ink uppercase">Primary Tech Stack</h3>
                      <div className="flex gap-2 flex-wrap max-w-full">
                        {techStackList.map((tech: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 border border-hairline bg-surface text-ink font-bold shrink-0">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(hasInfra || hasSecurity) && (
                    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${hasTechStack ? "pt-3 border-t border-hairline" : ""}`}>
                      {hasInfra && (
                        <div>
                          <h4 className="font-bold text-ink uppercase text-[11px]">Infrastructure &amp; Mesh</h4>
                          <p className="text-ink-dim mt-0.5 leading-relaxed break-words">{d.infraHosting}</p>
                        </div>
                      )}
                      {hasSecurity && (
                        <div>
                          <h4 className="font-bold text-ink uppercase text-[11px]">Security &amp; Compliance</h4>
                          <p className="text-ink-dim mt-0.5 leading-relaxed break-words">{d.securityStandards}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {(hasApiUrl || hasGithubUrl) && (
                    <div className="pt-3 border-t border-hairline space-y-2.5">
                      {hasApiUrl && (
                        <div>
                          <h4 className="font-bold text-ink uppercase text-[11px]">Open API Endpoint</h4>
                          {isValidHttpUrl(d.apiUrl) ? (
                            <a
                              href={d.apiUrl.startsWith("http") ? d.apiUrl : `https://${d.apiUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-signal font-mono text-[11px] mt-0.5 hover:underline break-all inline-block"
                            >
                              {d.apiUrl} ↗
                            </a>
                          ) : (
                            <p className="text-ink-dim/60 font-mono text-[11px] mt-0.5 break-all">
                              {d.apiUrl} <span className="text-[10px] text-ink-faint">(Not a valid link)</span>
                            </p>
                          )}
                        </div>
                      )}
                      {hasGithubUrl && (
                        <div>
                          <h4 className="font-bold text-ink uppercase text-[11px]">Source Code Repository</h4>
                          <a
                            href={d.githubUrl.startsWith("http") ? d.githubUrl : `https://${d.githubUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-signal font-mono text-[11px] mt-0.5 hover:underline break-all inline-block"
                          >
                            {d.githubUrl} ↗
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ),
            });
          }

          if (showStory) {
            visibleSections.push({
              id: "story",
              title: "Founder Story & Manifesto",
              content: (
                <div className="space-y-4 leading-relaxed font-mono text-xs">
                  {hasOriginStory && (
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-ink uppercase">Origin Story</h3>
                      <div className="space-y-2 text-ink-dim leading-relaxed whitespace-pre-line break-words font-sans text-xs sm:text-sm">
                        {formatPitchParagraphs(d.originStory).map((para: string, idx: number) => (
                          <p key={idx} className="leading-relaxed">{para}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasMakerThesis && (
                    <div className={`space-y-1.5 ${hasOriginStory ? "pt-3 border-t border-hairline" : ""}`}>
                      <h3 className="font-bold text-ink uppercase">Maker Thesis</h3>
                      <div className="space-y-2 text-ink-dim leading-relaxed italic whitespace-pre-line break-words border-l-2 border-l-signal pl-3 font-sans text-xs sm:text-sm">
                        {formatPitchParagraphs(d.makerThesis).map((para: string, idx: number) => (
                          <p key={idx} className="leading-relaxed">&ldquo;{para}&rdquo;</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-hairline text-ink-faint break-words font-mono text-xs">
                    <span>Maker Attribution: </span>
                    <strong className="text-ink">{product.makerName}</strong> ({product.maker})
                  </div>
                </div>
              ),
            });
          }

          if (showChangelog) {
            visibleSections.push({
              id: "changelog",
              title: "Changelog & Milestones",
              content: (
                <div className="space-y-4 leading-relaxed font-mono text-xs">
                  {hasChangelog && (
                    <div className="p-3 border border-hairline bg-surface/50 space-y-1.5">
                      <div className="flex items-center justify-between text-ink font-bold flex-wrap gap-1">
                        <h4 className="font-bold text-signal uppercase text-[11px]">{d.latestVersion || "LATEST DEPLOYMENT"}</h4>
                        <span className="text-[9px] text-signal uppercase font-bold px-1.5 py-0.5 border border-signal/40 bg-void">LATEST DEPLOYMENT</span>
                      </div>
                      {hasLatestChangelog && (
                        <p className="text-ink-dim text-[11px] leading-relaxed break-words">{d.latestChangelog}</p>
                      )}
                    </div>
                  )}

                  {hasRoadmap && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-hairline">
                      {d.roadmapQ3 && (
                        <div className="p-3 border border-hairline bg-void/50 space-y-1">
                          <h4 className="font-bold text-ink uppercase text-[11px]">Upcoming Milestone 01</h4>
                          <p className="text-ink-dim leading-relaxed break-words">{d.roadmapQ3}</p>
                        </div>
                      )}
                      {d.roadmapQ4 && (
                        <div className="p-3 border border-hairline bg-void/50 space-y-1">
                          <h4 className="font-bold text-ink uppercase text-[11px]">Upcoming Milestone 02</h4>
                          <p className="text-ink-dim leading-relaxed break-words">{d.roadmapQ4}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ),
            });
          }

          if (showFaqSupport) {
            visibleSections.push({
              id: "faq",
              title: "FAQ & Support",
              content: (
                <div className="space-y-4 leading-relaxed font-mono text-xs">
                  {hasFaqs && (
                    <div className="space-y-3">
                      {faqsList.map((faq, fIdx) => (
                        <div key={fIdx} className={`space-y-1 ${fIdx > 0 ? "pt-2 border-t border-hairline" : ""}`}>
                          <h4 className="font-bold text-ink uppercase break-words">Q: {faq.q}</h4>
                          <p className="text-ink-dim pl-3 border-l-2 border-hairline break-words">{faq.a}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {hasSupportEmail && (
                    <div className={`${hasFaqs ? "pt-3 border-t border-hairline" : ""} text-ink-faint break-words`}>
                      <span>Support Contact: </span>
                      <a href={`mailto:${d.supportEmail}`} className="text-signal underline font-bold break-all">
                        {d.supportEmail}
                      </a>
                    </div>
                  )}
                </div>
              ),
            });
          }

          if (visibleSections.length === 0) return null;

          const totalCount = visibleSections.length;
          const pad = (n: number) => String(n).padStart(2, "0");

          return (
            <div className="space-y-6 max-w-full overflow-hidden">
              {visibleSections.map((sec, idx) => (
                <div key={sec.id} className="border border-hairline bg-surface/30 p-4 sm:p-6 space-y-4 font-mono text-xs max-w-full overflow-hidden">
                  <div className="border-b border-hairline pb-2 flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="text-xs sm:text-sm font-bold text-ink uppercase tracking-wider">
                      {pad(idx + 1)}. {sec.title}
                    </h2>
                    <span className="text-[10px] text-ink-faint">
                      SECTION {pad(idx + 1)} / {pad(totalCount)}
                    </span>
                  </div>
                  {sec.content}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Founder Showcase Card */}
        <div className="border border-hairline bg-surface/40 p-4 sm:p-6 space-y-4 max-w-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-hairline pb-2.5">
            <h2 className="font-mono text-xs sm:text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-signal" />
              Meet the Founder
            </h2>
            <span className="text-[10px] font-mono text-ink-faint uppercase">
              Verified Maker
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
              {/* Founder Avatar with Proper Profile Picture */}
              <Link
                href={`/founder/${product.makerUsername || slugify(product.makerName || product.maker)}`}
                className="w-12 h-12 sm:w-14 sm:h-14 bg-surface border border-hairline rounded-sm flex items-center justify-center font-mono font-bold text-ink shrink-0 overflow-hidden relative group hover:border-signal transition-colors"
              >
                {product.makerImage ? (
                  <img width="64" height="64"
                    src={product.makerImage}
                    alt={product.makerName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <span className="text-xs sm:text-sm font-bold text-ink-dim uppercase">
                    {product.makerName.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </Link>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/founder/${product.makerUsername || slugify(product.makerName || product.maker)}`}
                    className="font-mono text-sm sm:text-base font-bold text-ink hover:text-signal transition-colors truncate"
                  >
                    {product.makerName}
                  </Link>
                  <span className="font-mono text-xs text-ink-dim">
                    {product.maker}
                  </span>
                </div>

                {product.makerTitle && (
                  <p className="font-mono text-xs text-ink-dim">
                    {product.makerTitle}
                  </p>
                )}

                {product.makerBio && (
                  <p className="font-sans text-xs sm:text-sm text-ink-dim leading-relaxed pt-1 line-clamp-3">
                    {product.makerBio}
                  </p>
                )}

                {/* Social links if available */}
                {(product.makerTwitter || product.makerGithub || product.makerWebsite) && (
                  <div className="flex items-center gap-2.5 pt-1.5 text-xs font-mono">
                    {product.makerTwitter && (
                      <a
                        href={product.makerTwitter.startsWith("http") ? product.makerTwitter : `https://x.com/${product.makerTwitter.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink-dim hover:text-signal transition-colors flex items-center gap-1 text-[11px]"
                      >
                        <span>𝕏</span>
                        <span>Twitter</span>
                      </a>
                    )}
                    {product.makerGithub && (
                      <a
                        href={product.makerGithub.startsWith("http") ? product.makerGithub : `https://github.com/${product.makerGithub.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink-dim hover:text-signal transition-colors flex items-center gap-1 text-[11px]"
                      >
                        <span>GitHub</span>
                      </a>
                    )}
                    {product.makerWebsite && (
                      <a
                        href={product.makerWebsite.startsWith("http") ? product.makerWebsite : `https://${product.makerWebsite}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink-dim hover:text-signal transition-colors flex items-center gap-1 text-[11px]"
                      >
                        <span>Website</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Link
              href={`/founder/${product.makerUsername || slugify(product.makerName || product.maker)}`}
              className="w-full sm:w-auto px-4 py-2 border border-hairline bg-void text-xs font-mono text-ink hover:bg-surface hover:border-signal/50 hover:text-signal transition-all text-center justify-center flex items-center shrink-0 self-start mt-2 sm:mt-0 font-medium"
            >
              View Founder Profile →
            </Link>
          </div>
        </div>

        {/* Founder Embeddable Badges Section (Only visible to the product's founder/admin) */}
        {isFounder && (
          <div id="embed" className="space-y-3 pt-2">
            <div className="flex items-center gap-2 border-l-2 border-signal pl-3 py-1 font-mono">
              <span className="text-xs font-bold text-signal uppercase tracking-wider">
                Founder Toolkit · Official Embed Badges
              </span>
              <span className="text-[10px] text-ink-dim uppercase">
                (Only visible to you)
              </span>
            </div>
            <EmbeddableAwardWidget
              productName={product.name}
              votes={product.votes}
              revenue={product.revenue}
              eligibleAwards={eligibleAwards}
            />
          </div>
        )}
      </div>

      {/* Lightbox Preview Modal */}
      {selectedImage && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-void border border-hairline max-w-4xl w-full p-4 sm:p-6 space-y-4 font-mono shadow-2xl relative"
          >
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <h3 className="text-xs sm:text-sm font-bold text-ink truncate">
                {selectedImage.startsWith("http") || selectedImage.startsWith("data:") || selectedImage.startsWith("/")
                  ? "High Resolution UI Preview"
                  : selectedImage}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="px-2 py-1 border border-hairline bg-surface text-xs text-ink hover:bg-raised transition-colors cursor-pointer font-bold"
              >
                Close ✕
              </button>
            </div>
            <div className="w-full max-h-[75vh] bg-surface border border-hairline flex items-center justify-center overflow-hidden p-2">
              {selectedImage.startsWith("http") || selectedImage.startsWith("data:") || selectedImage.startsWith("/") ? (
                <img width="64" height="64"
                  src={selectedImage}
                  alt="High Resolution Screenshot Preview"
                  className="max-h-[70vh] w-auto max-w-full object-contain rounded-xs shadow-lg"
                />
              ) : (
                <div className="text-ink-dim text-xs p-8 text-center">
                  Preview for <strong className="text-ink">{selectedImage}</strong>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <PrimaryCTA variant="product" className="mt-6" />

      {/* Similar Products in Category Section */}
      {similarProducts.length > 0 && (
        <section className="border border-hairline bg-surface/30 p-4 sm:p-6 space-y-4 font-mono mt-6">
          <div className="flex items-center justify-between gap-3 border-b border-hairline pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-signal shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold text-ink uppercase tracking-wider truncate">
                Similar Products in {product.category}
              </h2>
              <span className="text-[10px] text-ink-dim px-2 py-0.5 border border-hairline bg-void shrink-0">
                {similarProducts.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => scrollSimilar("left")}
                aria-label="Scroll left"
                className="w-7 h-7 border border-hairline bg-void hover:bg-surface text-ink flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollSimilar("right")}
                aria-label="Scroll right"
                className="w-7 h-7 border border-hairline bg-void hover:bg-surface text-ink flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
              >
                →
              </button>
            </div>
          </div>

          {/* Horizontal Scroll Carousel */}
          <div
            ref={similarScrollRef}
            className="flex items-stretch gap-3.5 overflow-x-auto no-scrollbar scroll-smooth py-1 -mx-1 px-1"
          >
            {similarProducts.map((sim) => (
              <Link
                key={sim.id}
                href={`/product/${sim.slug}`}
                className="w-[240px] sm:w-[270px] shrink-0 border border-hairline bg-void hover:border-ink hover:bg-surface/50 transition-all p-3.5 flex flex-col justify-between group space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-9 h-9 bg-surface border border-hairline flex items-center justify-center font-mono font-bold text-xs text-ink shrink-0 overflow-hidden">
                      {sim.logoUrl ? (
                        <img width="64" height="64"
                          src={sim.logoUrl}
                          alt={sim.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        sim.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 border border-hairline text-ink-dim uppercase bg-surface shrink-0 truncate max-w-[120px]">
                      {sim.categoryName}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-mono text-xs font-bold text-ink group-hover:text-signal transition-colors truncate">
                      {sim.name}
                    </h3>
                    <p className="font-mono text-[11px] text-ink-dim line-clamp-2 leading-relaxed mt-1">
                      {sim.tagline}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-hairline/60 text-[10px] font-mono text-ink-dim">
                  <span className="truncate">{sim.maker || "Indie Maker"}</span>
                  <span className="font-bold text-signal border border-signal/30 px-1.5 py-0.5 bg-void">
                    ▲ {sim.voteCount}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ProductComments
        productSlug={product.slug || slugify(product.name)}
        productName={product.name}
        makerName={product.makerName}
        makerHandle={product.maker}
        initialComments={initialComments}
      />
    </MainLayoutShell>
  );
}
