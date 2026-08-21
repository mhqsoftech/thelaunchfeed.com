import type { Metadata } from "next";
import Link from "next/link";
import { LaunchFeedBrandLogo } from "@/components/ui/LaunchFeedLogo";
import { organizationNode, websiteNode, breadcrumb } from "@/lib/seo/schema";
import ManageCookieButton from "@/app/components/ManageCookieButton";

export const metadata: Metadata = {
  title: "Privacy Policy - The Launch Feed",
  description:
    "The Launch Feed Privacy Policy: Learn how we collect, protect, and handle account information, telemetry keys, and product specifications.",
  alternates: {
    canonical: "https://thelaunchfeed.com/privacy",
  },
  openGraph: {
    title: "Privacy Policy - The Launch Feed",
    description:
      "The Launch Feed Privacy Policy: Learn how we collect, protect, and handle account information, telemetry keys, and product specifications.",
    type: "website",
    url: "https://thelaunchfeed.com/privacy",
    siteName: "The Launch Feed",
    images: [{ url: "/thelaunchfeed-logo.png", width: 1477, height: 272, alt: "Privacy Policy - The Launch Feed" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy - The Launch Feed",
    description:
      "The Launch Feed Privacy Policy: Learn how we collect, protect, and handle account information, telemetry keys, and product specifications.",
    images: ["/thelaunchfeed-logo.png"],
    creator: "@thelaunchfeed",
  },
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "August 16, 2026";
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      {
        ...breadcrumb([
          { name: "Home", url: siteUrl },
          { name: "Privacy Policy", url: `${siteUrl}/privacy` },
        ]),
        "@id": `${siteUrl}/privacy#breadcrumb`,
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
        <h1 className="sr-only">Privacy Policy</h1>
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
            <span className="text-ink font-semibold">Privacy Policy</span>
          </nav>

          <div className="text-xs text-ink-dim flex items-center gap-2 flex-wrap">
            <Link href="/about" className="hover:text-ink transition-colors">About</Link>
            <span>&middot;</span>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms</Link>
            <span>&middot;</span>
            <Link href="/privacy" className="text-signal font-bold">Privacy</Link>
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
            <span>01. Introduction</span>
          </h2>
          <p>
            The Launch Feed (&quot;we&quot;, &quot;our&quot;, or &quot;the Platform&quot;) operates the website at <a href="https://thelaunchfeed.com" className="text-signal font-mono font-bold hover:underline">thelaunchfeed.com</a>. This Privacy Policy describes how we collect, use, process, and safeguard your personal data when you visit our website, submit a product, cast votes, or interact with our services.
          </p>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>02. Information We Collect</span>
          </h2>
          <div className="space-y-3 pl-2 sm:pl-3 border-l-2 border-signal/40">
            <div className="bg-surface/20 p-3 rounded-xs space-y-1">
              <strong className="text-ink font-mono text-xs uppercase block">
                A. Account &amp; Identity Data
              </strong>
              <p>
                When you authenticate via Neon Auth, Google OAuth, GitHub OAuth, or email magic links, we receive your email address, full name, avatar profile image, and username.
              </p>
            </div>

            <div className="bg-surface/20 p-3 rounded-xs space-y-1">
              <strong className="text-ink font-mono text-xs uppercase block">
                B. Product Submission &amp; 360° Specs
              </strong>
              <p>
                When you submit a software product, we store product names, taglines, UI screenshots, architectural diagrams, tech stack components, repository URLs, and founder bios. This information is published publicly on our leaderboards.
              </p>
            </div>

            <div className="bg-surface/20 p-3 rounded-xs space-y-1">
              <strong className="text-ink font-mono text-xs uppercase block">
                C. Telemetry &amp; Financial Verification Keys
              </strong>
              <p>
                If you choose to verify your startup&apos;s MRR, you may provide a read-only payment gateway key (e.g. Stripe or Polar). All API keys are encrypted at rest using industry-standard <strong className="text-ink font-mono">AES-256-GCM</strong> encryption and are never exposed in public responses.
              </p>
            </div>

            <div className="bg-surface/20 p-3 rounded-xs space-y-1">
              <strong className="text-ink font-mono text-xs uppercase block">
                D. Usage, Voting &amp; Telemetry Data
              </strong>
              <p>
                We record upvote timestamps, comment interactions, IP addresses (hashed for anti-botting fraud protection), browser user agents, and referral paths to enforce fair leaderboard rankings.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>03. How We Use Your Information</span>
          </h2>
          <ul className="list-disc pl-4 sm:pl-5 space-y-2">
            <li>To publish and display your software products on daily, weekly, monthly, and yearly leaderboards.</li>
            <li>To schedule and execute the automated 6:00 AM IST (00:30 UTC) daily drop queue.</li>
            <li>To broadcast launches across official 𝕏, Telegram, and WhatsApp channels.</li>
            <li>To generate public machine-readable AI feeds at <code className="px-1.5 py-0.5 border border-hairline bg-surface text-signal font-mono text-xs rounded-xs">/llms.txt</code> for search engines and LLM crawlers.</li>
            <li>To prevent vote manipulation, spam submissions, and malicious activity.</li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>04. Third-Party Service Providers</span>
          </h2>
          <p>
            We partner with reliable third-party infrastructure providers to operate the platform securely:
          </p>
          <ul className="list-disc pl-4 sm:pl-5 space-y-2">
            <li><strong className="text-ink">Neon Database:</strong> Serverless PostgreSQL database hosting and authentication engine.</li>
            <li><strong className="text-ink">Vercel:</strong> Edge hosting, serverless computing, and CDN caching.</li>
            <li><strong className="text-ink">Resend:</strong> Transactional email dispatch for authentication and launch notifications.</li>
            <li><strong className="text-ink">Stripe &amp; Polar:</strong> Payment processing for paid spotlight slots and MRR telemetry verification.</li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>05. Cookies &amp; Telemetry Policy</span>
          </h2>
          <p>
            We use strictly necessary cookies and local storage tokens to secure user sessions and remember your interface preferences. Optional telemetry cookies help us analyze traffic patterns and optimize platform performance.
          </p>
          <div className="overflow-x-auto border border-hairline rounded-xs">
            <table className="w-full text-left font-mono text-[11px] sm:text-xs">
              <thead className="bg-surface/60 text-ink border-b border-hairline">
                <tr>
                  <th className="p-2 sm:p-2.5">Category</th>
                  <th className="p-2 sm:p-2.5">Provider / Key</th>
                  <th className="p-2 sm:p-2.5">Purpose</th>
                  <th className="p-2 sm:p-2.5">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                <tr className="bg-void">
                  <td className="p-2 sm:p-2.5 font-bold text-ink">Essential</td>
                  <td className="p-2 sm:p-2.5 text-signal">better-auth.session_token</td>
                  <td className="p-2 sm:p-2.5 font-sans text-ink-dim">User login authentication &amp; secure session validation</td>
                  <td className="p-2 sm:p-2.5 text-verified font-bold">Strictly Necessary</td>
                </tr>
                <tr className="bg-surface/20">
                  <td className="p-2 sm:p-2.5 font-bold text-ink">Preference</td>
                  <td className="p-2 sm:p-2.5 text-signal">tlf-theme (localStorage)</td>
                  <td className="p-2 sm:p-2.5 font-sans text-ink-dim">Remembers chosen UI theme (Void, Thermal, Light)</td>
                  <td className="p-2 sm:p-2.5 text-verified font-bold">Functional</td>
                </tr>
                <tr className="bg-void">
                  <td className="p-2 sm:p-2.5 font-bold text-ink">Consent</td>
                  <td className="p-2 sm:p-2.5 text-signal">tlf_cookie_consent</td>
                  <td className="p-2 sm:p-2.5 font-sans text-ink-dim">Saves your cookie consent choices to avoid repeated prompts</td>
                  <td className="p-2 sm:p-2.5 text-verified font-bold">Functional</td>
                </tr>
                <tr className="bg-surface/20">
                  <td className="p-2 sm:p-2.5 font-bold text-ink">Analytics</td>
                  <td className="p-2 sm:p-2.5 text-signal">_ga, _ga_* (Google)</td>
                  <td className="p-2 sm:p-2.5 font-sans text-ink-dim">Measures pageviews, bounce rates, and traffic referrals</td>
                  <td className="p-2 sm:p-2.5 text-signal font-bold">Optional (Consent)</td>
                </tr>
                <tr className="bg-void">
                  <td className="p-2 sm:p-2.5 font-bold text-ink">Heatmaps</td>
                  <td className="p-2 sm:p-2.5 text-signal">_clck, _clsk (Clarity)</td>
                  <td className="p-2 sm:p-2.5 font-sans text-ink-dim">Anonymous scroll and click telemetry to optimize UX</td>
                  <td className="p-2 sm:p-2.5 text-signal font-bold">Optional (Consent)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-ink-dim font-sans">
              You can adjust or revoke your cookie choices at any time.
            </p>
            <ManageCookieButton />
          </div>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>06. Data Retention &amp; User Rights</span>
          </h2>
          <p>
            You have full control over your data. You may request the export or complete deletion of your account, votes, and submitted products at any time. To exercise your rights under GDPR, CCPA, or applicable international privacy regulations, contact our privacy desk at <a href="mailto:hi@thelaunchfeed.com" className="text-signal font-mono font-bold hover:underline">hi@thelaunchfeed.com</a>.
          </p>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-sm sm:text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full shrink-0" />
            <span>07. Contact Us</span>
          </h2>
          <p>
            If you have questions or concerns regarding this Privacy Policy, please contact our team via <Link href="/contact" className="text-signal font-mono font-bold hover:underline">our contact form</Link> or email us directly at <a href="mailto:hi@thelaunchfeed.com" className="text-signal font-mono font-bold hover:underline">hi@thelaunchfeed.com</a>.
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
            <Link href="/terms" className="hover:text-signal transition-colors">Terms</Link>
            <span>&middot;</span>
            <Link href="/contact" className="hover:text-signal transition-colors">Contact</Link>
            <span>&middot;</span>
            <Link href="/badges" className="hover:text-signal transition-colors">Badges</Link>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
