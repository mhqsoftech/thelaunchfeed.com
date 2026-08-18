import type { Metadata } from "next";
import Link from "next/link";
import { LaunchFeedBrandLogo } from "@/components/ui/LaunchFeedLogo";

export const metadata: Metadata = {
  title: "Terms of Service - The Launch Feed",
  description:
    "The Launch Feed Terms of Service: Guidelines, product submission rules, voting integrity standards, and platform conditions.",
  alternates: {
    canonical: "https://thelaunchfeed.com/terms",
  },
  openGraph: {
    title: "Terms of Service - The Launch Feed",
    description:
      "The Launch Feed Terms of Service: Guidelines, product submission rules, voting integrity standards, and platform conditions.",
    type: "website",
    url: "https://thelaunchfeed.com/terms",
    siteName: "The Launch Feed",
    images: [{ url: "/thelaunchfeed-logo.png", width: 1477, height: 272, alt: "Terms of Service - The Launch Feed" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service - The Launch Feed",
    description:
      "The Launch Feed Terms of Service: Guidelines, product submission rules, voting integrity standards, and platform conditions.",
    images: ["/thelaunchfeed-logo.png"],
    creator: "@thelaunchfeed",
  },
};

export default function TermsOfServicePage() {
  const lastUpdated = "August 16, 2026";

  return (
    <div className="max-w-4xl mx-auto py-5 sm:py-10 px-3.5 sm:px-6 space-y-6 sm:space-y-8 font-mono text-ink">
      <h1 className="sr-only">Terms of Service</h1>
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs font-mono font-bold text-ink transition-colors cursor-pointer group rounded-xs"
        >
          <span className="text-signal group-hover:-translate-x-0.5 transition-transform">←</span>
          <span>Back to Leaderboard</span>
        </Link>
        <div className="text-xs text-ink-dim flex items-center gap-2 flex-wrap">
          <Link href="/about" className="hover:text-ink transition-colors">About</Link>
          <span>&middot;</span>
          <Link href="/terms" className="text-signal font-bold">Terms</Link>
          <span>&middot;</span>
          <Link href="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
          <span>&middot;</span>
          <Link href="/contact" className="hover:text-ink transition-colors">Contact</Link>
        </div>
      </div>

      {/* Header Banner */}
      <div className="border border-hairline p-4 sm:p-7 bg-surface/30 space-y-3 rounded-xs">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <LaunchFeedBrandLogo height={28} />
          </Link>
        </div>
        <div className="text-xs text-ink-dim flex items-center gap-2 flex-wrap">
          <span>Effective &amp; Last Updated:</span>
          <strong className="text-ink font-mono bg-surface px-1.5 py-0.5 border border-hairline rounded-xs">{lastUpdated}</strong>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="border border-hairline p-4 sm:p-8 bg-void space-y-6 sm:space-y-8 font-sans text-xs sm:text-sm text-ink-dim leading-relaxed rounded-xs">
        <section className="space-y-3">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>01. Acceptance of Terms</span>
          </h2>
          <p>
            By accessing or using The Launch Feed (<a href="https://thelaunchfeed.com" className="text-signal font-mono font-bold hover:underline">thelaunchfeed.com</a>), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not access or use our services.
          </p>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>02. Platform Voting Integrity &amp; Anti-Spam</span>
          </h2>
          <p>
            The Launch Feed is built on fairness, authenticity, and prestige. You agree strictly NOT to:
          </p>
          <ul className="list-disc pl-4 sm:pl-5 space-y-2">
            <li>Engage in coordinated voting rings, botting, fake account generation, or vote buying.</li>
            <li>Submit malicious, misleading, deceptive, or infringing software products.</li>
            <li>Attempt to tamper with daily, weekly, monthly, or yearly leaderboard score algorithms.</li>
            <li>Post abusive, discriminatory, or unsolicited commercial messages in community comment sections.</li>
          </ul>
          <p className="text-xs text-ink-faint bg-surface/40 p-2.5 border border-hairline rounded-xs">
            Violations will result in immediate disqualification, removal from leaderboards, and permanent revocation of maker account privileges.
          </p>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>03. Product Submissions &amp; License Grant</span>
          </h2>
          <p>
            When you submit a product, logo, screenshots, or 360° technical details:
          </p>
          <ul className="list-disc pl-4 sm:pl-5 space-y-2">
            <li>You confirm you own or possess all necessary rights and authorizations to publish the submitted assets.</li>
            <li>You grant The Launch Feed a worldwide, non-exclusive, royalty-free license to host, display, broadcast on official social channels, and distribute machine-readable summaries via <code className="px-1.5 py-0.5 border border-hairline bg-surface text-signal font-mono text-xs rounded-xs">/llms.txt</code> for search engine indexing.</li>
            <li>You retain all intellectual property ownership of your underlying software, brands, and codebases.</li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>04. Paid Spotlight &amp; Featured Placements</span>
          </h2>
          <p>
            The Launch Feed offers optional paid spotlight and rotating header placements. All purchases are final once the advertising delivery cycle commences. In the event of platform downtime or delivery failure, pro-rated replacement impressions or credits will be provided.
          </p>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>05. Disclaimer of Warranties</span>
          </h2>
          <p>
            The Launch Feed is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express or implied. We do not endorse or guarantee the quality, safety, or reliability of any third-party software products submitted by users.
          </p>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>06. Contact &amp; Copyright Notices</span>
          </h2>
          <p>
            For legal inquiries, terms clarification, or DMCA copyright infringement notices, please contact us at <a href="mailto:hi@thelaunchfeed.com" className="text-signal font-mono font-bold hover:underline">hi@thelaunchfeed.com</a> or visit our <Link href="/contact" className="text-signal font-mono font-bold hover:underline">Contact Page</Link>.
          </p>
        </section>

        {/* Bottom Actions Bar */}
        <div className="border-t border-hairline pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs font-mono font-bold text-ink transition-colors cursor-pointer group rounded-xs w-full sm:w-auto justify-center"
          >
            <span className="text-signal group-hover:-translate-x-0.5 transition-transform">←</span>
            <span>Back to Leaderboard</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-ink-dim flex-wrap justify-center">
            <Link href="/about" className="hover:text-signal transition-colors">About</Link>
            <span>&middot;</span>
            <Link href="/privacy" className="hover:text-signal transition-colors">Privacy Policy</Link>
            <span>&middot;</span>
            <Link href="/contact" className="hover:text-signal transition-colors">Contact</Link>
            <span>&middot;</span>
            <Link href="/badges" className="hover:text-signal transition-colors">Badges</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
