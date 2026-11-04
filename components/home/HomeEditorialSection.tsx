import { LaunchTime } from "@/components/ui/LaunchTime";
import { withLaunchTime } from "@/components/ui/withLaunchTime";
import Link from "next/link";
import { CORE_FAQS, REVENUE_PROVIDERS, faqPageNode, type Faq } from "@/lib/seo/facts";

const FEATURES = [
  {
    tag: "Ranking",
    title: "A fresh board every day",
    desc: "Launches go live at 6:00 AM IST and collect upvotes for 24 hours. The day's top three are saved to the hall of fame, and every launch keeps ranking on the weekly, monthly, yearly and all-time boards.",
  },
  {
    tag: "Announcements",
    title: "Shared on our channels",
    desc: "Each launch is announced on Telegram, WhatsApp and Bluesky with your tagline and maker handle. The daily top three get a second winner post.",
  },
  {
    tag: "Revenue",
    title: "Verified revenue, if you want it",
    desc: `Connect a read-only key from one of ${REVENUE_PROVIDERS.length} payment providers, including Stripe, Polar, Lemon Squeezy, Paddle and Dodo Payments, to show verified MRR on your product page.`,
  },
  {
    tag: "Badges",
    title: "Badges for your site and README",
    desc: "Embed a live ranking badge that updates as you climb, in light, dark, signal or minimal style. Top three finishers earn winner badges for the day, week, month and year.",
  },
  {
    tag: "Your page",
    title: "A permanent product page",
    desc: "Screenshots, description, maker profile and a link to your site: dofollow while our badge stays on it, and always on paid launches.",
  },
  {
    tag: "Details",
    title: "How it's built",
    desc: "Optionally list your tech stack, hosting and the story behind the product, so developers can see what's under the hood.",
  },
];

const COMPARISONS = [
  {
    feature: "Multi-Channel Social Broadcast",
    theLaunchFeed: "Automatic launch announcements on Telegram, WhatsApp and Bluesky",
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
    theLaunchFeed: "Schema.org JSON-LD, llms.txt, and a dofollow link to your site (free launches keep it while our badge stays up)",
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

const FAQS: Faq[] = [
  ...CORE_FAQS,
  {
    q: "Where is my launch announced?",
    a: "When your product goes live at 6:00 AM IST, it is announced on our social channels (Telegram, WhatsApp and Bluesky) with your tagline, maker handle and a link to the product page. The daily top three get a second winner announcement.",
  },
];

export function HomeEditorialSection({
  categories,
  liveProducts,
}: {
  categories?: CategoryTaxonomyItem[];
  liveProducts?: LiveTopProductItem[];
} = {}) {
  const displayCategories = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  const top = (liveProducts && liveProducts.length > 0 ? liveProducts : DEFAULT_LIVE_PRODUCTS).slice(0, 5);

  const faqSchema = { "@context": "https://schema.org", ...faqPageNode("https://thelaunchfeed.com/", FAQS) };

  return (
    <section aria-labelledby="about-heading" className="mt-6 space-y-6 text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Answer-first summary — the paragraph search & AI engines quote. */}
      <div className="rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card p-6 sm:p-8">
        <h2 id="about-heading" className="text-2xl sm:text-3xl font-semibold tracking-tight max-w-3xl">
          What is The Launch Feed?
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-dim max-w-3xl">
          <strong className="text-ink font-semibold">The Launch Feed is a free daily leaderboard for new software, SaaS and AI
          products.</strong>{" "}
          A fresh batch of launches goes live every day at <LaunchTime showIst />. The maker community upvotes them for 24
          hours, then the top three are frozen into the daily hall of fame and roll up into weekly, monthly, yearly and all-time
          boards. Founders get a permanent product page, a live ranking badge, optional verified-revenue proof, and an
          announcement across Telegram, WhatsApp and Bluesky.
        </p>
        <dl className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { k: "Launch time", v: <><LaunchTime /> daily</> },
            { k: "Cost to launch", v: "Free" },
            { k: "Leaderboards", v: "Day, week, month, year" },
            { k: "Revenue proof", v: "Stripe, Polar, Lemon Squeezy, Dodo" },
          ].map((f) => (
            <div key={f.k} className="rounded-xl bg-surface px-4 py-3">
              <dt className="text-xs text-ink-faint">{f.k}</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{f.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* How it works */}
      <div className="rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">How launching works</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            { t: "Submit in minutes", d: "Paste your URL and autofill pulls your name, tagline, logo and screenshots. Pick a launch day." },
            { t: "Go live at 6:00 AM IST", d: "Your product joins the daily board and is announced to our Telegram, WhatsApp and Bluesky channels." },
            { t: "Rank, win, embed", d: "Top 3 finishers earn podium badges and winner emails. Embed your live rank badge anywhere." },
          ].map((step, i) => (
            <li key={step.t} className="relative rounded-xl border border-hairline p-5">
              <span className="font-display font-black text-3xl text-signal leading-none">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 font-semibold text-ink">{withLaunchTime(step.t)}</h3>
              <p className="mt-1 text-sm text-ink-dim leading-relaxed">{step.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/submit" className="inline-flex items-center h-10 px-5 rounded-full bg-signal text-white text-sm font-semibold hover:brightness-110">
            Launch your product free
          </Link>
          <Link href="/launch-guide" className="inline-flex items-center h-10 px-5 rounded-full border border-hairline text-sm font-medium hover:bg-surface">
            Read the launch guide
          </Link>
          <Link href="/product-hunt-alternative" className="inline-flex items-center h-10 px-5 rounded-full border border-hairline text-sm font-medium hover:bg-surface">
            Compare with Product Hunt
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight px-1">What every launch gets</h2>
        <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-[var(--radius-card)] border border-hairline bg-card p-5">
              <p className="text-xs font-medium text-signal">{f.tag}</p>
              <h3 className="mt-1.5 font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink-dim leading-relaxed">{withLaunchTime(f.desc)}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Live top products — internal links into the strongest pages */}
      <div className="rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card p-6 sm:p-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Most upvoted of all time</h2>
          <Link href="/leaderboard/all-time" className="shrink-0 text-sm font-semibold text-signal hover:underline">
            Hall of fame
          </Link>
        </div>
        <ol className="mt-4 divide-y divide-hairline">
          {top.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <span className={`w-6 font-display font-black text-lg ${i === 0 ? "text-signal" : "text-ink-faint"}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/product/${p.slug}`} className="font-semibold text-ink hover:text-signal">
                  {p.name}
                </Link>
                <p className="text-sm text-ink-dim truncate">{p.tagline}</p>
              </div>
              {p.category?.name && <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-surface text-ink-dim">{p.category.name}</span>}
              <span className="font-mono text-sm font-semibold tabular-nums">▲ {p.voteCount.toLocaleString("en-US")}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Comparison */}
      <div className="rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">The Launch Feed vs. traditional launch platforms</h2>
        <div className="mt-4 -mx-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-faint">
                <th scope="col" className="px-2 py-2 font-medium">Feature</th>
                <th scope="col" className="px-2 py-2 font-medium text-signal">The Launch Feed</th>
                <th scope="col" className="px-2 py-2 font-medium">Typical platforms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {COMPARISONS.map((row) => (
                <tr key={row.feature} className="align-top">
                  <th scope="row" className="px-2 py-3 text-left font-semibold text-ink">{row.feature}</th>
                  <td className="px-2 py-3 text-ink">{withLaunchTime(row.theLaunchFeed)}</td>
                  <td className="px-2 py-3 text-ink-dim">{row.traditional}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Categories */}
      <div className="rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card p-6 sm:p-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Explore by category</h2>
          <Link href="/categories" className="shrink-0 text-sm font-semibold text-signal hover:underline">
            All categories
          </Link>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {displayCategories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/category/${c.slug}`}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full border border-hairline text-sm text-ink hover:border-signal/50 hover:text-signal transition-colors"
              >
                {c.name}
                <span className="font-mono text-xs text-ink-faint">{c.productCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* FAQ — native <details> keeps every answer in the HTML for crawlers. */}
      <div className="rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-4 divide-y divide-hairline">
          {FAQS.map((faq, i) => (
            <details key={faq.q} className="group py-1" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                <h3 className="text-[15px]">{faq.q}</h3>
                <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-hairline text-ink-dim transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="pb-4 pr-10 text-sm leading-relaxed text-ink-dim">
                {withLaunchTime(faq.a)}
                {faq.link && (
                  <>
                    {" "}
                    <Link href={faq.link.href} className="font-medium text-signal hover:underline">
                      {faq.link.label}
                    </Link>
                  </>
                )}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
