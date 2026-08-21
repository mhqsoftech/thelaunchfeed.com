import type { Metadata } from "next";
import Link from "next/link";
import { LaunchFeedBrandLogo } from "@/components/ui/LaunchFeedLogo";
import { organizationNode, websiteNode, breadcrumb } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "About - The Launch Feed",
  description:
    "Learn about The Launch Feed: the 360° product intelligence platform and daily software leaderboard built for authentic indie makers, SaaS builders, and engineering teams.",
  alternates: {
    canonical: "https://thelaunchfeed.com/about",
  },
  openGraph: {
    title: "About - The Launch Feed",
    description:
      "The 360° product intelligence platform and daily software leaderboard built for authentic indie makers and SaaS builders.",
    type: "website",
    url: "https://thelaunchfeed.com/about",
    siteName: "The Launch Feed",
    images: [{ url: "/thelaunchfeed-logo.png", width: 1477, height: 272, alt: "About The Launch Feed" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About - The Launch Feed",
    description:
      "The 360° product intelligence platform and daily software leaderboard built for authentic indie makers and SaaS builders.",
    images: ["/thelaunchfeed-logo.png"],
    creator: "@thelaunchfeed",
  },
};

export default function AboutPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      {
        ...breadcrumb([
          { name: "Home", url: siteUrl },
          { name: "About", url: `${siteUrl}/about` },
        ]),
        "@id": `${siteUrl}/about#breadcrumb`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-4xl mx-auto py-5 sm:py-10 px-3.5 sm:px-6 space-y-6 sm:space-y-8 font-mono text-ink">
        <h1 className="sr-only">About The Launch Feed</h1>
        {/* Top Navigation & Breadcrumbs */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-hairline pb-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono text-ink-dim">
            <Link
              href="/"
              className="hover:text-ink transition-colors flex items-center gap-1"
            >
              <span>Home</span>
            </Link>
            <span className="text-ink-faint">/</span>
            <span className="text-ink font-semibold">About</span>
          </nav>

          <div className="text-xs text-ink-dim flex items-center gap-2 flex-wrap">
            <Link href="/about" className="text-signal font-bold">About</Link>
            <span>&middot;</span>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms</Link>
            <span>&middot;</span>
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
            <span>&middot;</span>
            <Link href="/contact" className="hover:text-ink transition-colors">Contact</Link>
          </div>
        </div>

      {/* Header Banner */}
      <div className="border border-hairline p-4 sm:p-7 bg-surface/30 space-y-3 sm:space-y-4 rounded-xs">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <LaunchFeedBrandLogo height={32} />
          </Link>
        </div>
        <p className="text-xs sm:text-sm text-ink-dim font-sans leading-relaxed">
          The Launch Feed is a high-signal, community-driven software leaderboard and 360° product intelligence engine. We help indie builders, bootstrapped SaaS founders, and engineering teams ship new products, verify real revenue, and earn prestige on a transparent daily leaderboard.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] sm:text-xs">
          <span className="px-2 py-1 border border-signal/40 bg-signal/10 text-signal font-bold rounded-xs">
            DAILY 6:00 AM IST DROPS
          </span>
          <span className="px-2 py-1 border border-hairline bg-surface text-ink-dim rounded-xs">
            360° ARCHITECTURE SPECS
          </span>
          <span className="px-2 py-1 border border-hairline bg-surface text-ink-dim rounded-xs">
            VERIFIED FOUNDER MRR
          </span>
        </div>
      </div>

      {/* Core Mission & Philosophy */}
      <div className="space-y-4 sm:space-y-6">
        <div className="border-b border-hairline pb-2">
          <h2 className="text-base sm:text-lg font-bold text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal shrink-0" />
            <span>01. Why We Built The Launch Feed</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-xs sm:text-sm text-ink-dim leading-relaxed">
          <div className="p-4 sm:p-5 border border-hairline bg-surface/20 space-y-2 rounded-xs">
            <h3 className="font-mono font-bold text-xs sm:text-sm text-ink flex items-center gap-2">
              <span className="text-signal">⚡</span>
              <span>The Problem with Legacy Launchpads</span>
            </h3>
            <p>
              Traditional product discovery directories have become saturated with spam, paid upvote rings, and surface-level marketing one-liners. Technical users, developers, and discerning customers get zero insight into how tools are actually built, their infrastructure, or authentic founder stories.
            </p>
          </div>
          <div className="p-4 sm:p-5 border border-hairline bg-surface/20 space-y-2 rounded-xs">
            <h3 className="font-mono font-bold text-xs sm:text-sm text-ink flex items-center gap-2">
              <span className="text-signal">✓</span>
              <span>The 360° Intelligence Solution</span>
            </h3>
            <p>
              The Launch Feed introduces deep 360-degree technical blueprints: architecture maps, tech stack teardowns, database engines, verified MRR telemetry, milestone changelogs, and direct maker links. Makers launch with substantial technical credibility, and users discover tools they can genuinely trust.
            </p>
          </div>
        </div>
      </div>

      {/* The 4 Architectural Pillars */}
      <div className="space-y-4 sm:space-y-6">
        <div className="border-b border-hairline pb-2">
          <h2 className="text-base sm:text-lg font-bold text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal shrink-0" />
            <span>02. Platform Pillars &amp; Standards</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 sm:p-5 border border-hairline bg-surface/30 space-y-2 rounded-xs">
            <div className="text-[10px] sm:text-xs font-mono font-bold text-signal uppercase">Pillar 01</div>
            <div className="font-bold text-ink text-xs sm:text-sm">Automated 6:00 AM IST Daily Release Queue</div>
            <p className="font-sans text-xs text-ink-dim leading-relaxed">
              Every submitted product enters the queue and automatically launches worldwide at exactly 6:00 AM IST (00:30 UTC). This guarantees an equal playing field where every product gets full 24-hour cycle exposure.
            </p>
          </div>
          <div className="p-4 sm:p-5 border border-hairline bg-surface/30 space-y-2 rounded-xs">
            <div className="text-[10px] sm:text-xs font-mono font-bold text-signal uppercase">Pillar 02</div>
            <div className="font-bold text-ink text-xs sm:text-sm">Multi-Channel Social Broadcast</div>
            <p className="font-sans text-xs text-ink-dim leading-relaxed">
              Upon release, every product is automatically broadcasted across official 𝕏 (Twitter), Telegram, and WhatsApp broadcast channels, amplifying makers directly to engaged tech audiences.
            </p>
          </div>
          <div className="p-4 sm:p-5 border border-hairline bg-surface/30 space-y-2 rounded-xs">
            <div className="text-[10px] sm:text-xs font-mono font-bold text-signal uppercase">Pillar 03</div>
            <div className="font-bold text-ink text-xs sm:text-sm">Verified MRR &amp; Stripe Telemetry</div>
            <p className="font-sans text-xs text-ink-dim leading-relaxed">
              Founders can optionally connect read-only Stripe/Polar API keys. Our telemetry engine validates real MRR and displays cryptographic verified badges, celebrating radical financial transparency.
            </p>
          </div>
          <div className="p-4 sm:p-5 border border-hairline bg-surface/30 space-y-2 rounded-xs">
            <div className="text-[10px] sm:text-xs font-mono font-bold text-signal uppercase">Pillar 04</div>
            <div className="font-bold text-ink text-xs sm:text-sm">AI Agent &amp; LLM Indexing (llms.txt)</div>
            <p className="font-sans text-xs text-ink-dim leading-relaxed">
              All live listings generate structured Schema.org JSON-LD and live markdown feeds at <code className="px-1.5 py-0.5 border border-hairline bg-surface text-signal font-mono text-xs rounded-xs">/llms.txt</code> and <code className="px-1.5 py-0.5 border border-hairline bg-surface text-signal font-mono text-xs rounded-xs">/llms-full.txt</code>, ensuring products are cited and indexed by next-gen AI search engines like Perplexity, ChatGPT, and Claude.
            </p>
          </div>
        </div>
      </div>

      {/* Creator Attribution & Contact Callout */}
      <div className="border border-hairline p-4 sm:p-7 bg-surface/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 rounded-xs">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <img width="64" height="64"
            src="/menajulm.avif"
            alt="Menajul Hoque"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border border-hairline shrink-0"
          />
          <div>
            <div className="text-[10px] sm:text-xs text-ink-faint uppercase font-bold">Creator &amp; Architect</div>
            <div className="text-sm sm:text-base font-bold text-ink mt-0.5">Menajul Hoque</div>
            <a
              href="https://x.com/menajulm"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-signal hover:underline flex items-center gap-1 mt-0.5"
            >
              <span>@menajulm on 𝕏</span>
              <span>→</span>
            </a>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            href="/contact"
            className="w-full sm:w-auto text-center px-4 py-2 border border-hairline bg-surface hover:bg-raised text-xs font-bold text-ink transition-colors rounded-xs"
          >
            Contact Team
          </Link>
          <Link
            href="/submit"
            className="w-full sm:w-auto text-center px-4 py-2 bg-signal text-void text-xs font-bold hover:bg-signal/90 transition-colors rounded-xs shadow-xs"
          >
            Launch a Product ($0)
          </Link>
        </div>
      </div>

      {/* Bottom Navigation Actions */}
      <div className="border-t border-hairline pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs font-mono font-bold text-ink transition-colors cursor-pointer group rounded-xs w-full sm:w-auto justify-center"
        >
          <span className="text-signal group-hover:-translate-x-0.5 transition-transform">←</span>
          <span>Back to Leaderboard</span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-ink-dim flex-wrap justify-center">
          <Link href="/terms" className="hover:text-signal transition-colors">Terms of Service</Link>
          <span>&middot;</span>
          <Link href="/privacy" className="hover:text-signal transition-colors">Privacy Policy</Link>
          <span>&middot;</span>
          <Link href="/contact" className="hover:text-signal transition-colors">Contact</Link>
          <span>&middot;</span>
          <Link href="/badges" className="hover:text-signal transition-colors">Badges</Link>
        </div>
      </div>
    </div>
    </>
  );
}
