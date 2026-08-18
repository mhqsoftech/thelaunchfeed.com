"use client";

import React, { useState } from "react";
import Link from "next/link";

const FEATURES = [
  {
    num: "01",
    tag: "DISCOVERY & RANKING",
    title: "Algorithmic 24-Hour Launch Board",
    desc: "Every product launches into a transparent 24-hour cycle starting at 6:00 AM IST. Rankings are computed in real-time with verified upvote weighting, historical snapshots, and anti-spam protection.",
    metrics: "24h cycle · 6 AM IST reset · Anti-bot scoring",
    badge: "CORE ENGINE",
  },
  {
    num: "02",
    tag: "SOCIAL DISTRIBUTION",
    title: "Automated Multi-Channel Social Broadcast",
    desc: "Every product launch and Top 3 podium winner (#1, #2, #3) is automatically broadcasted across WhatsApp, Bluesky, and Telegram to active founders, tech operators, and builders.",
    metrics: "WhatsApp Community · Bluesky Viral Feed · Telegram VIP Telemetry",
    badge: "SOCIAL NETWORK",
  },
  {
    num: "03",
    tag: "FINANCIAL TRANSPARENCY",
    title: "Live Verified Revenue Badges",
    desc: "Connect Stripe, Polar, Lemon Squeezy, Paddle, or Dodo Payments via cryptographic OAuth to display tamper-proof MRR & ARR badges directly on your product card.",
    metrics: "7+ Payment Providers · Cryptographic Proof · Monthly Growth %",
    badge: "VERIFIED MRR",
  },
  {
    num: "04",
    tag: "VIRAL DISTRIBUTION",
    title: "Bespoke Geometric Vector SVG Badges",
    desc: "Embed bespoke vector SVG award badges directly into your GitHub README or landing page that automatically reflect your live rank (Daily, Weekly, Monthly, Yearly, All-Time).",
    metrics: "Custom Geometric Emblems · Real-time SVG · 4 Themes",
    badge: "AWARD EMBEDS",
  },
  {
    num: "05",
    tag: "FOUNDER & MAKER ECOSYSTEM",
    title: "Dedicated Founder Portfolios & Dofollow SEO",
    desc: "Every launched product gains high-authority dofollow backlinks, structured schema.org metadata, rich screenshot carousels, and a dedicated maker profile page.",
    metrics: "Indexable JSON-LD · Dofollow Backlinks · Maker Threads",
    badge: "SEARCH OPTIMIZED",
  },
  {
    num: "06",
    tag: "TECH INTELLIGENCE",
    title: "360° Technical Architecture Specs",
    desc: "Every product showcases deep engineering specs: frontend frameworks, cloud databases, backend infrastructure, hosting providers, and founder architecture manifestos.",
    metrics: "Framework Telemetry · Database Specs · Infra Hosting",
    badge: "TECH SPECS",
  },
];

const COMPARISONS = [
  {
    feature: "Multi-Channel Social Broadcast",
    theLaunchFeed: "Automated instant multi-channel push across WhatsApp, X, and Telegram",
    traditional: "No social push or paywalled promotional add-ons",
  },
  {
    feature: "Top 3 Podium Celebration & Awards",
    theLaunchFeed: "Dedicated social winner broadcasts, custom SVG vector emblems & founder email alerts",
    traditional: "Generic static PNG badges with no multi-channel shoutouts",
  },
  {
    feature: "Launch Timing & Moderation",
    theLaunchFeed: "Synchronized 6:00 AM IST 24-hour daily drops with transparent queues",
    traditional: "Opaque review queues and weeks-long waiting lists",
  },
  {
    feature: "Revenue & Traction Verification",
    theLaunchFeed: "Real-time OAuth verification (Stripe, Polar, Paddle, LS, Dodo)",
    traditional: "Unverified claims or self-reported screenshots",
  },
  {
    feature: "Ranking Algorithm Transparency",
    theLaunchFeed: "Transparent daily cycles, automated UTC snapshots & archives",
    traditional: "Opaque algorithmic black-boxes with hidden demotions",
  },
  {
    feature: "SEO & Backlink Authority",
    theLaunchFeed: "Clean semantic HTML, Schema.org JSON-LD, dofollow product URLs",
    traditional: "Cloaked redirect links with nofollow attributes",
  },
];

export type CategoryTaxonomyItem = {
  id?: string;
  slug: string;
  name: string;
  productCount: number;
};

export type LiveTopProductItem = {
  id: string;
  name: string;
  tagline: string;
  slug: string;
  voteCount: number;
  owner?: { username: string | null; name: string | null } | null;
  category?: { name: string } | null;
  revenue?: { mrrCents: number; isVerified: boolean } | null;
};

const DEFAULT_LIVE_PRODUCTS: LiveTopProductItem[] = [
  {
    id: "notion",
    name: "Notion",
    tagline: "The connected workspace for notes, docs, wikis, and AI",
    slug: "notion",
    voteCount: 1547,
    owner: { username: "ivanzhao", name: "Ivan Zhao" },
    category: { name: "Productivity" },
    revenue: null,
  },
  {
    id: "figma",
    name: "Figma",
    tagline: "Where teams design, prototype, and build software together",
    slug: "figma",
    voteCount: 1042,
    owner: { username: "dylanfield", name: "Dylan Field" },
    category: { name: "Design" },
    revenue: null,
  },
  {
    id: "shadcn-ui",
    name: "shadcn/ui",
    tagline: "Beautifully designed components you can copy and paste into your apps",
    slug: "shadcn-ui",
    voteCount: 725,
    owner: { username: "shadcn", name: "shadcn" },
    category: { name: "Open Source" },
    revenue: null,
  },
  {
    id: "supabase",
    name: "Supabase",
    tagline: "The open source Firebase alternative built on Postgres",
    slug: "supabase",
    voteCount: 628,
    owner: { username: "kiwicopple", name: "Paul Copplestone" },
    category: { name: "Developer Tools" },
    revenue: null,
  },
];

const DEFAULT_CATEGORIES: CategoryTaxonomyItem[] = [
  { slug: "ai", name: "AI & Machine Learning", productCount: 5 },
  { slug: "dev-tools", name: "Developer Tools", productCount: 4 },
  { slug: "saas", name: "SaaS & Cloud Software", productCount: 2 },
  { slug: "design", name: "Design & UI/UX", productCount: 4 },
  { slug: "open-source", name: "Open Source Software", productCount: 2 },
  { slug: "productivity", name: "Productivity & Workflow", productCount: 1 },
  { slug: "fintech", name: "Fintech & Payments", productCount: 1 },
  { slug: "seo-ai-visibility", name: "SEO & AI Visibility", productCount: 1 },
];

const FAQS = [
  {
    q: "How does launching on The Launch Feed work?",
    a: "Founders submit their product details, screenshots, video demo, and target category. Submissions are scheduled for a chosen 6:00 AM IST daily launch slot or published immediately after verification. During the 24-hour cycle, the community discovers, tests, and upvotes listings on the live leaderboard.",
  },
  {
    q: "How does automated social broadcasting work for my product?",
    a: "The instant your product goes live at 6:00 AM IST, our broadcast engine dispatches formatted announcements across our verified Bluesky feed (@thelaunchfeed.bsky.social), WhatsApp community, and Telegram VIP channel with your product tagline, maker handles, and direct spec links.",
  },
  {
    q: "How are Top 3 podium winners featured and rewarded?",
    a: "At the close of each 24-hour cycle (and weekly/monthly cycles), the 1st, 2nd, and 3rd placed products are snapshotted into the hall of fame. Winners receive dedicated celebratory broadcasts on WhatsApp, Bluesky, and Telegram, automated founder email trophies, and unlock bespoke embeddable vector SVG award badges.",
  },
  {
    q: "What makes The Launch Feed different from legacy launch platforms?",
    a: "The Launch Feed emphasizes algorithmic fairness, automated multi-channel social distribution, direct payment provider revenue verification (Stripe, Polar, Lemon Squeezy, Paddle, Dodo), dynamic vector SVG badges that update live on external websites, and clean search engine indexability with permanent dofollow backlinks.",
  },
  {
    q: "How do verified revenue badges work?",
    a: "Makers can optionally link their payment provider through read-only OAuth or secure API connections. Our backend queries real-time MRR and verified customer counts, displaying an authoritative green verified revenue badge on your product page.",
  },
  {
    q: "How do I embed a live ranking badge on my website or GitHub README?",
    a: "Every product receives a dynamic vector SVG badge endpoint at `/api/badge/[slug]` that supports multiple themes (light, dark, signal, minimal). Simply copy the Markdown, HTML, or React snippet from your founder profile into your README or landing page hero.",
  },
  {
    q: "Is it free to submit and launch a product?",
    a: "Yes! Standard product submissions, automated social distribution, and public leaderboard placements are completely free for all indie founders, startups, and open-source creators.",
  },
];

function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.761.78 2.791.78 3.182 0 5.769-2.587 5.769-5.766.001-3.182-2.585-5.766-5.769-5.766zm3.393 8.163c-.144.405-.837.774-1.17.824-.312.045-.634.075-1.87-.417-1.393-.552-2.316-1.954-2.385-2.048-.07-.094-.567-.754-.567-1.442 0-.687.359-1.026.487-1.168.127-.142.279-.178.372-.178.093 0 .186.002.268.006.086.004.202-.033.315.24.117.28.401.979.436 1.05.035.071.058.154.012.247-.047.094-.07.153-.14.235-.07.082-.147.184-.21.247-.07.07-.143.146-.062.285.082.139.363.599.78 1.01.536.529.988.693 1.127.763.139.07.221.058.303-.035.081-.093.349-.406.442-.546.093-.14.186-.117.314-.07.128.047.814.384.954.454.14.07.233.105.267.163.035.058.035.337-.109.742z" />
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.527 3.663 1.444 5.178L2 22l4.981-1.306A9.954 9.954 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.25c-1.634 0-3.15-.49-4.423-1.332l-.317-.209-2.955.775.789-2.881-.228-.363A8.214 8.214 0 013.75 12c0-4.549 3.701-8.25 8.25-8.25s8.25 3.701 8.25 8.25-3.701 8.25-8.25 8.25z" />
    </svg>
  );
}

function XTwitterIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function BlueskyIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 600 530" fill="currentColor" aria-hidden="true">
      <path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.26-54.316 97.782-155.54 164.28-205.463C512.26 8.024 590 -19.44 590 69.24c0 17.7-10.15 148.79-16.11 170.07-20.68 73.94-96.14 92.86-163.23 81.42 117.3 19.95 147.16 86.06 82.72 152.16-122.34 125.55-175.83-31.51-189.53-71.76-2.51-7.38-3.68-10.83-3.85-7.88-.17-2.95-1.34.5-3.85 7.88-13.7 40.26-67.19 197.31-189.53 71.76-64.44-66.1-34.58-132.21 82.72-152.16-67.09 11.44-142.55-7.48-163.22-81.42C20.15 217.99 10 86.9 10 69.24c0-88.68 77.74-61.216 125.72-25.21z" />
    </svg>
  );
}

function TelegramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

export function HomeEditorialSection({
  categories,
  liveProducts,
}: {
  categories?: CategoryTaxonomyItem[];
  liveProducts?: LiveTopProductItem[];
} = {}) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const displayCategories =
    categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const items =
    liveProducts && liveProducts.length > 0
      ? liveProducts
      : DEFAULT_LIVE_PRODUCTS;
  const p1 = items[0] || DEFAULT_LIVE_PRODUCTS[0];
  const p2 = items[1] || DEFAULT_LIVE_PRODUCTS[1];
  const p3 = items[2] || DEFAULT_LIVE_PRODUCTS[2];
  const specProduct =
    items.find((p) => p.revenue?.isVerified) ||
    items[3] ||
    items[0] ||
    DEFAULT_LIVE_PRODUCTS[3];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://thelaunchfeed.com/#website",
        "url": "https://thelaunchfeed.com",
        "name": "The Launch Feed",
        "description": "Daily leaderboard and discovery platform for the best new software products, SaaS tools, and AI startups.",
        "publisher": {
          "@type": "Organization",
          "name": "The Launch Feed",
          "url": "https://thelaunchfeed.com",
        },
      },
      {
        "@type": "FAQPage",
        "@id": "https://thelaunchfeed.com/#faq",
        "mainEntity": FAQS.map((faq) => ({
          "@type": "Question",
          "name": faq.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.a,
          },
        })),
      },
    ],
  };

  return (
    <section className="mt-12 space-y-12 border-t border-hairline pt-10 text-ink">
      {/* Structured SEO Data for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      {/* ── Section Header / Manifesto ── */}
      <div className="border border-hairline bg-surface/30 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-signal mb-2">
          <span className="w-2 h-2 rounded-full bg-signal" />
          <span>The Next-Generation Software Launchpad</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight uppercase max-w-3xl">
          Discover Tomorrow&apos;s Breakout Software & AI Products Today
        </h2>
        <p className="mt-3 text-sm sm:text-base font-mono text-ink-dim leading-relaxed max-w-3xl">
          The Launch Feed is the real-time curated leaderboard for indie hackers, founders, and engineering teams.
          Every day, innovative creators launch new developer tools, SaaS applications, AI workflows, and design systems
          to an audience of thousands of early adopters, tech investors, and operators.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/submit"
            className="px-4 py-2 text-xs font-mono uppercase font-bold border border-signal bg-signal text-void hover:bg-signal/90 transition-colors"
          >
            + Launch Your Product Free
          </Link>
          <Link
            href="/founders"
            className="px-4 py-2 text-xs font-mono uppercase font-bold border border-hairline bg-surface hover:bg-raised text-ink transition-colors"
          >
            Explore Maker Directory
          </Link>
        </div>
      </div>

      {/* ── 6 Core Capabilities Grid ── */}
      <div>
        <div className="mb-4 flex items-baseline justify-between border-b border-hairline pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink-dim">
              Platform Features
            </span>
            <span className="text-xs text-ink-faint">/ Built for Maximum Product Velocity</span>
          </div>
          <span className="text-[11px] font-mono uppercase text-signal font-bold">
            6 Core Engines
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.num}
              className="border border-hairline p-5 bg-surface/20 hover:bg-surface/50 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-black text-signal text-lg">{f.num}</span>
                    <span className="text-[10px] font-mono uppercase font-bold text-ink-dim border border-hairline px-1.5 py-0.5">
                      {f.tag}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase font-bold text-signal px-2 py-0.5 border border-signal/40 bg-void">
                    {f.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold font-mono tracking-tight text-ink mb-2">
                  {f.title}
                </h3>
                <p className="text-xs font-mono text-ink-dim leading-relaxed">
                  {f.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-hairline/60 text-[11px] font-mono text-ink-faint">
                {"//"} {f.metrics}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Multi-Channel Social Broadcast Network Showcase ── */}
      <div className="border border-hairline bg-surface/25 p-3.5 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 rounded-xs">
        {/* Full-Width Header */}
        <div className="space-y-2.5 sm:space-y-3 border-b border-hairline pb-4 sm:pb-5">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-widest text-signal">
            <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse shrink-0" />
            <span>Multi-Channel Social Distribution Engine</span>
          </div>
          <h3 className="text-lg sm:text-2xl lg:text-3xl font-display font-black uppercase text-ink tracking-tight w-full leading-tight">
            Every Launch &amp; Top 3 Podium Winner Broadcasted Live
          </h3>
          <p className="text-xs sm:text-sm font-mono text-ink-dim w-full leading-relaxed">
            When you launch on The Launch Feed, your product is instantly distributed across our 3 verified social networks reaching active founders, tech operators, and early adopters.
          </p>

          {/* Social Channel Quick-Action Buttons — Full-Width on Mobile, Grid on Tablet/Desktop */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
            <a
              href="https://chat.whatsapp.com/HxTenCRhtHa9PIviuQNl9U"
              target="_blank"
              rel="noreferrer"
              className="w-full px-3.5 py-2.5 text-xs font-mono font-bold uppercase border border-hairline bg-surface/80 hover:bg-surface text-ink hover:text-emerald-400 transition-colors flex items-center justify-center gap-2 rounded-xs text-center"
            >
              <WhatsAppIcon className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="truncate">Join WhatsApp Community</span>
            </a>
            <a
              href="https://bsky.app/profile/thelaunchfeed.bsky.social"
              target="_blank"
              rel="noreferrer"
              className="w-full px-3.5 py-2.5 text-xs font-mono font-bold uppercase border border-hairline bg-surface/80 hover:bg-surface text-ink hover:text-[#0085FF] transition-colors flex items-center justify-center gap-2 rounded-xs text-center"
            >
              <BlueskyIcon className="w-3.5 h-3.5 text-[#0085FF] shrink-0" />
              <span className="truncate">Follow on Bluesky</span>
            </a>
            <a
              href="https://t.me/thelaunchfeed"
              target="_blank"
              rel="noreferrer"
              className="w-full px-3.5 py-2.5 text-xs font-mono font-bold uppercase border border-hairline bg-surface/80 hover:bg-surface text-ink hover:text-sky-400 transition-colors flex items-center justify-center gap-2 rounded-xs text-center"
            >
              <TelegramIcon className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="truncate">Telegram VIP Channel</span>
            </a>
          </div>
        </div>

        {/* 3 Interactive Channel Preview Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Channel 1: WhatsApp */}
          <div className="border border-hairline bg-surface/30 p-3.5 sm:p-4 space-y-3 flex flex-col justify-between rounded-xs">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-ink flex items-center gap-1.5">
                  <WhatsAppIcon className="w-4 h-4 text-emerald-500" />
                  <span>WhatsApp Broadcast</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400/90 px-1.5 py-0.5 border border-emerald-500/25 bg-surface/50">
                  INSTANT PUSH
                </span>
              </div>
              <div className="bg-surface/60 border border-hairline p-2.5 sm:p-3 rounded-xs text-[11px] font-mono text-ink-dim leading-relaxed space-y-1.5 overflow-hidden">
                <div className="text-emerald-400 font-bold">{"// NEW LAUNCH BROADCAST"}</div>
                <div className="text-ink truncate">
                  <Link href={`/product/${p1.slug}`} className="hover:underline">
                    <span className="font-bold text-ink">{p1.name}</span> — <i>{p1.tagline}</i>
                  </Link>
                </div>
                <div className="text-ink-dim truncate">MAKER: @{p1.owner?.username || "maker"}</div>
                <div className="text-ink-faint truncate">
                  SPECS: <Link href={`/product/${p1.slug}`} className="hover:text-ink">thelaunchfeed.com/product/{p1.slug}</Link>
                </div>
                <div className="text-[10px] text-ink-faint pt-1 border-t border-hairline">
                  PODIUM REWARDS: Top 3 Finishers announced daily at 6:00 AM IST
                </div>
              </div>
            </div>
            <div className="pt-2">
              <a
                href="https://chat.whatsapp.com/HxTenCRhtHa9PIviuQNl9U"
                target="_blank"
                rel="noreferrer"
                className="w-full text-center py-2 text-xs font-mono font-bold uppercase border border-hairline bg-surface hover:bg-raised text-ink hover:text-emerald-400 transition-colors flex items-center justify-center gap-1.5 rounded-xs"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-500" />
                <span>Join WhatsApp Community</span>
              </a>
            </div>
          </div>

          {/* Channel 2: Bluesky */}
          <div className="border border-hairline bg-surface/30 p-3.5 sm:p-4 space-y-3 flex flex-col justify-between rounded-xs">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-ink flex items-center gap-1.5">
                  <BlueskyIcon className="w-4 h-4 text-[#0085FF]" />
                  <span>Bluesky Feed</span>
                </span>
                <span className="text-[10px] font-mono text-[#0085FF]/90 px-1.5 py-0.5 border border-[#0085FF]/30 bg-surface/50">
                  VIRAL REACH
                </span>
              </div>
              <div className="bg-surface/60 border border-hairline p-2.5 sm:p-3 rounded-xs text-[11px] font-mono text-ink-dim leading-relaxed space-y-1.5 overflow-hidden">
                <div className="text-signal font-bold">{"// DAILY TOP 3 WINNERS"}</div>
                <div className="truncate">
                  #01 <Link href={`/product/${p1.slug}`} className="font-bold text-ink hover:underline">{p1.name}</Link> ({p1.voteCount.toLocaleString()} votes)
                </div>
                <div className="truncate">
                  #02 <Link href={`/product/${p2.slug}`} className="font-bold text-ink hover:underline">{p2.name}</Link> ({p2.voteCount.toLocaleString()} votes)
                </div>
                <div className="truncate">
                  #03 <Link href={`/product/${p3.slug}`} className="font-bold text-ink hover:underline">{p3.name}</Link> ({p3.voteCount.toLocaleString()} votes)
                </div>
                <div className="text-signal text-[10px] truncate">AWARDS: Live vector badges at thelaunchfeed.com</div>
                <div className="text-ink-faint text-[10px] truncate">#buildinpublic #indiehackers #saas</div>
              </div>
            </div>
            <div className="pt-2">
              <a
                href="https://bsky.app/profile/thelaunchfeed.bsky.social"
                target="_blank"
                rel="noreferrer"
                className="w-full text-center py-2 text-xs font-mono font-bold uppercase border border-hairline bg-surface hover:bg-raised text-ink hover:text-[#0085FF] transition-colors flex items-center justify-center gap-1.5 rounded-xs"
              >
                <BlueskyIcon className="w-3.5 h-3.5 text-[#0085FF]" />
                <span>Follow @thelaunchfeed.bsky.social</span>
              </a>
            </div>
          </div>

          {/* Channel 3: Telegram */}
          <div className="border border-hairline bg-surface/30 p-3.5 sm:p-4 space-y-3 flex flex-col justify-between rounded-xs">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-ink flex items-center gap-1.5">
                  <TelegramIcon className="w-4 h-4 text-sky-400" />
                  <span>Telegram VIP Stream</span>
                </span>
                <span className="text-[10px] font-mono text-sky-400/90 px-1.5 py-0.5 border border-sky-500/25 bg-surface/50">
                  REAL-TIME TELEMETRY
                </span>
              </div>
              <div className="bg-surface/60 border border-hairline p-2.5 sm:p-3 rounded-xs text-[11px] font-mono text-ink-dim leading-relaxed space-y-1.5 overflow-hidden">
                <div className="text-sky-400 font-bold">{"// 360° ARCHITECTURE SPECS"}</div>
                <div className="text-ink truncate">
                  <Link href={`/product/${specProduct.slug}`} className="hover:underline">
                    <span className="font-bold text-ink">{specProduct.name}</span> — <i>{specProduct.tagline}</i>
                  </Link>
                </div>
                <div className="text-ink-dim truncate">CATEGORY: {specProduct.category?.name || "Developer Tools"}</div>
                <div className="text-verified font-bold text-[10px] truncate">
                  {specProduct.revenue?.isVerified
                    ? `VERIFIED MRR: $${Math.round(specProduct.revenue.mrrCents / 100).toLocaleString()} / mo`
                    : "VERIFIED ARCHITECTURE & LAUNCH"}
                </div>
                <div className="text-ink-faint truncate">
                  URL: <Link href={`/product/${specProduct.slug}`} className="hover:text-ink">thelaunchfeed.com/product/{specProduct.slug}</Link>
                </div>
              </div>
            </div>
            <div className="pt-2">
              <a
                href="https://t.me/thelaunchfeed"
                target="_blank"
                rel="noreferrer"
                className="w-full text-center py-2 text-xs font-mono font-bold uppercase border border-hairline bg-surface hover:bg-raised text-ink hover:text-sky-400 transition-colors flex items-center justify-center gap-1.5 rounded-xs"
              >
                <TelegramIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Join Telegram Stream</span>
              </a>
            </div>
          </div>
        </div>

        {/* 3-Step Social Broadcast Protocol */}
        <div className="border-t border-hairline pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 text-xs font-mono">
          <div className="flex items-start gap-2.5">
            <span className="font-display font-black text-signal text-base shrink-0">01</span>
            <div>
              <div className="font-bold text-ink uppercase">6:00 AM IST Synchronized Launch</div>
              <div className="text-ink-dim text-[11px] mt-0.5 leading-relaxed">
                Your product goes live on the board and is immediately pushed across WhatsApp, X, and Telegram.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="font-display font-black text-signal text-base shrink-0">02</span>
            <div>
              <div className="font-bold text-ink uppercase">24-Hour Live Ranking</div>
              <div className="text-ink-dim text-[11px] mt-0.5 leading-relaxed">
                Early adopters test your software, inspect 360° architecture specs, and upvote your listing in real time.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="font-display font-black text-signal text-base shrink-0">03</span>
            <div>
              <div className="font-bold text-ink uppercase">Podium Crowning &amp; Badges</div>
              <div className="text-ink-dim text-[11px] mt-0.5 leading-relaxed">
                Top 3 daily, weekly, and monthly winners unlock bespoke vector SVG award badges and get celebrated on all social channels.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── High-Impact Comparison Matrix (Responsive Cards for Mobile, Full Table for Desktop) ── */}
      <div>
        <div className="mb-4 flex items-baseline justify-between border-b border-hairline pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink-dim">
              Why Launch Here
            </span>
            <span className="text-xs text-ink-faint">/ The Launch Feed vs Legacy Platforms</span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono uppercase text-ink-dim font-bold">
            Transparent Standards
          </span>
        </div>

        {/* Mobile-Optimized Comparison Cards (< sm) */}
        <div className="sm:hidden space-y-3">
          {COMPARISONS.map((c, i) => (
            <div key={i} className="border border-hairline bg-surface/25 p-3.5 rounded-xs space-y-2 font-mono text-xs">
              <div className="font-bold text-ink border-b border-hairline/60 pb-1.5">
                {c.feature}
              </div>
              <div className="space-y-1.5">
                <div className="p-2 bg-signal/10 border border-signal/30 rounded-xs text-ink text-[11px] leading-relaxed">
                  <div className="text-[10px] font-bold text-signal uppercase tracking-wider mb-0.5">The Launch Feed</div>
                  <span className="text-signal font-bold mr-1">[+]</span>
                  {c.theLaunchFeed}
                </div>
                <div className="p-2 bg-surface/40 border border-hairline rounded-xs text-ink-dim text-[11px] leading-relaxed">
                  <div className="text-[10px] font-bold text-ink-faint uppercase tracking-wider mb-0.5">Traditional Platforms</div>
                  <span className="text-ink-faint mr-1">[-]</span>
                  {c.traditional}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop / Tablet Table View (>= sm) */}
        <div className="hidden sm:block border border-hairline overflow-x-auto bg-surface/20 rounded-xs">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-hairline bg-surface/50 text-[11px] uppercase text-ink-dim font-bold">
                <th className="p-3.5 w-1/3">Capability</th>
                <th className="p-3.5 w-1/3 text-signal">The Launch Feed</th>
                <th className="p-3.5 w-1/3 text-ink-dim">Traditional Platforms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {COMPARISONS.map((c, i) => (
                <tr key={i} className="hover:bg-surface/30 transition-colors">
                  <td className="p-3.5 font-bold text-ink">{c.feature}</td>
                  <td className="p-3.5 text-ink bg-signal/5 font-medium">
                    <span className="text-signal mr-1.5 font-bold font-mono">[+]</span>
                    {c.theLaunchFeed}
                  </td>
                  <td className="p-3.5 text-ink-dim">
                    <span className="text-ink-faint mr-1.5 font-mono">[-]</span>
                    {c.traditional}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Trending Categories Directory ── */}
      <div>
        <div className="mb-4 flex items-baseline justify-between border-b border-hairline pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink-dim">
              Software Taxonomy
            </span>
            <span className="text-xs text-ink-faint">/ Browse Trending Tech Sectors</span>
          </div>
          <span className="text-[11px] font-mono uppercase text-ink-dim font-bold">
            {displayCategories.length} Categories
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {displayCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="border border-hairline p-3 bg-surface/20 hover:bg-surface hover:border-signal transition-all group"
            >
              <div className="text-xs font-mono font-bold text-ink group-hover:text-signal truncate">
                {cat.name}
              </div>
              <div className="text-[10px] font-mono text-ink-dim mt-1 flex items-center justify-between">
                <span>{cat.productCount} {cat.productCount === 1 ? "product" : "products"}</span>
                <span className="text-ink-faint group-hover:text-signal font-mono">/</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Frequently Asked Questions (FAQ) ── */}
      <div>
        <div className="mb-4 flex items-baseline justify-between border-b border-hairline pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink-dim">
              Frequently Asked Questions
            </span>
            <span className="text-xs text-ink-faint">/ Launch Guide & FAQ</span>
          </div>
          <span className="text-[11px] font-mono uppercase text-signal font-bold">
            Knowledge Base
          </span>
        </div>

        <div className="border border-hairline divide-y divide-hairline bg-surface/20">
          {FAQS.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} className="transition-colors">
                <button
                  type="button"
                  onClick={() => toggleFaq(i)}
                  className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-mono text-sm font-bold text-ink hover:text-signal cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-signal text-xs font-mono">[{String(i + 1).padStart(2, "0")}]</span>
                    <span>{faq.q}</span>
                  </span>
                  <span className="text-sm text-ink-dim shrink-0 font-mono">
                    {isOpen ? "[-]" : "[+]"}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm font-mono text-ink-dim leading-relaxed border-t border-hairline/50 pt-3 bg-surface/30">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Call To Action ── */}
      <div className="border border-signal/40 bg-gradient-to-r from-signal/10 via-surface/40 to-signal/5 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <div className="text-[10px] font-mono uppercase font-bold text-signal tracking-widest mb-1">
            Ready to show your work to the world?
          </div>
          <h3 className="text-xl sm:text-2xl font-display font-black uppercase text-ink">
            Launch Your Next Product On The Feed
          </h3>
          <p className="text-xs font-mono text-ink-dim mt-1 max-w-xl">
            Join thousands of founders shipping daily. Free submission, verified traffic, and live community feedback.
          </p>
        </div>
        <Link
          href="/submit"
          className="px-6 py-3 text-xs font-mono uppercase font-bold border border-signal bg-signal text-void hover:bg-signal/90 transition-all shrink-0 shadow-xs hover:scale-105"
        >
          Submit Your Launch Free
        </Link>
      </div>
    </section>
  );
}
