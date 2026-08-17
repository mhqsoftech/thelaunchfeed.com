import type { Metadata } from "next";
import Link from "next/link";
import { LaunchFeedBrandLogo } from "@/components/ui/LaunchFeedLogo";

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

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 space-y-8 font-mono text-ink">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-hairline bg-surface hover:bg-raised hover:border-signal/60 text-xs font-mono font-bold text-ink transition-colors cursor-pointer group rounded-xs"
        >
          <span className="text-signal group-hover:-translate-x-0.5 transition-transform">←</span>
          <span>Back to The Launch Feed</span>
        </Link>
        <div className="text-xs text-ink-faint hidden sm:flex items-center gap-2.5">
          <Link href="/terms" className="hover:text-ink transition-colors">Terms</Link>
          <span>&middot;</span>
          <Link href="/privacy" className="text-signal font-bold">Privacy</Link>
          <span>&middot;</span>
          <Link href="/contact" className="hover:text-ink transition-colors">Contact</Link>
        </div>
      </div>

      {/* Header Banner */}
      <div className="border border-hairline p-6 sm:p-8 bg-surface/30 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <LaunchFeedBrandLogo height={28} />
          </Link>
        </div>
        <div className="text-xs text-ink-dim flex items-center gap-2">
          <span>Effective &amp; Last Updated:</span>
          <strong className="text-ink font-mono">{lastUpdated}</strong>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="border border-hairline p-6 sm:p-8 bg-void space-y-8 font-sans text-sm text-ink-dim leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-mono font-bold text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full" />
            <span>01. Introduction</span>
          </h2>
          <p>
            The Launch Feed (&quot;we&quot;, &quot;our&quot;, or &quot;the Platform&quot;) operates the website at <a href="https://thelaunchfeed.com" className="text-signal hover:underline">thelaunchfeed.com</a>. This Privacy Policy describes how we collect, use, process, and safeguard your personal data when you visit our website, submit a product, cast votes, or interact with our services.
          </p>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full" />
            <span>02. Information We Collect</span>
          </h2>
          <div className="space-y-3 pl-2 border-l border-hairline/60">
            <div>
              <strong className="text-ink font-mono text-xs uppercase block mb-1">
                A. Account &amp; Identity Data
              </strong>
              <p>
                When you authenticate via Neon Auth, Google OAuth, GitHub OAuth, or email magic links, we receive your email address, full name, avatar profile image, and username.
              </p>
            </div>

            <div>
              <strong className="text-ink font-mono text-xs uppercase block mb-1">
                B. Product Submission &amp; 360° Specs
              </strong>
              <p>
                When you submit a software product, we store product names, taglines, UI screenshots, architectural diagrams, tech stack components, repository URLs, and founder bios. This information is published publicly on our leaderboards.
              </p>
            </div>

            <div>
              <strong className="text-ink font-mono text-xs uppercase block mb-1">
                C. Telemetry &amp; Financial Verification Keys
              </strong>
              <p>
                If you choose to verify your startup&apos;s MRR, you may provide a read-only payment gateway key (e.g. Stripe or Polar). All API keys are encrypted at rest using industry-standard <strong>AES-256-GCM</strong> encryption and are never exposed in public responses.
              </p>
            </div>

            <div>
              <strong className="text-ink font-mono text-xs uppercase block mb-1">
                D. Usage, Voting &amp; Telemetry Data
              </strong>
              <p>
                We record upvote timestamps, comment interactions, IP addresses (hashed for anti-botting fraud protection), browser user agents, and referral paths to enforce fair leaderboard rankings.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full" />
            <span>03. How We Use Your Information</span>
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To publish and display your software products on daily, weekly, monthly, and yearly leaderboards.</li>
            <li>To schedule and execute the automated 6:00 AM IST (00:30 UTC) daily drop queue.</li>
            <li>To broadcast launches across official 𝕏, Telegram, and WhatsApp channels.</li>
            <li>To generate public machine-readable AI feeds at <code>/llms.txt</code> for search engines and LLM crawlers.</li>
            <li>To prevent vote manipulation, spam submissions, and malicious activity.</li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full" />
            <span>04. Third-Party Service Providers</span>
          </h2>
          <p>
            We partner with reliable third-party infrastructure providers to operate the platform securely:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Neon Database:</strong> Serverless PostgreSQL database hosting and authentication engine.</li>
            <li><strong>Vercel:</strong> Edge hosting, serverless computing, and CDN caching.</li>
            <li><strong>Resend:</strong> Transactional email dispatch for authentication and launch notifications.</li>
            <li><strong>Stripe &amp; Polar:</strong> Payment processing for paid spotlight slots and MRR telemetry verification.</li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full" />
            <span>05. Data Retention &amp; User Rights</span>
          </h2>
          <p>
            You have full control over your data. You may request the export or complete deletion of your account, votes, and submitted products at any time. To exercise your rights under GDPR, CCPA, or applicable international privacy regulations, contact our privacy desk at <a href="mailto:hi@thelaunchfeed.com" className="text-signal font-mono font-bold hover:underline">hi@thelaunchfeed.com</a>.
          </p>
        </section>

        <section className="space-y-3 border-t border-hairline pt-6">
          <h2 className="font-mono font-bold text-base text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-signal rounded-full" />
            <span>06. Contact Us</span>
          </h2>
          <p>
            If you have questions or concerns regarding this Privacy Policy, please contact our team via <Link href="/contact" className="text-signal hover:underline">our contact form</Link> or email us directly at <a href="mailto:hi@thelaunchfeed.com" className="text-signal font-mono font-bold hover:underline">hi@thelaunchfeed.com</a>.
          </p>
        </section>

        {/* Bottom Actions Bar */}
        <div className="border-t border-hairline pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 border border-hairline bg-surface hover:bg-raised hover:border-signal/60 text-xs font-mono font-bold text-ink transition-colors cursor-pointer group rounded-xs w-full sm:w-auto justify-center"
          >
            <span className="text-signal group-hover:-translate-x-0.5 transition-transform">←</span>
            <span>Back to The Launch Feed</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-ink-dim">
            <Link href="/terms" className="hover:text-signal transition-colors">Terms of Service</Link>
            <span>&middot;</span>
            <Link href="/contact" className="hover:text-signal transition-colors">Contact Support</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
