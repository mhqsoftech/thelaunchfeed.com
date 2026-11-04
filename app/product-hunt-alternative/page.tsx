import type { Metadata } from "next";
import Link from "next/link";
import MainLayoutShell from "@/app/MainLayoutShell";
import { withLaunchTime } from "@/components/ui/withLaunchTime";
import { Card, Crumbs, FactGrid, FaqSection, H2, LaunchCta } from "@/components/seo/LandingParts";
import { SITE_URL, breadcrumb, webPageNode } from "@/lib/seo/schema";
import {
  CONTENT_UPDATED_ISO,
  CONTENT_UPDATED_LABEL,
  FAQ_BACKLINK,
  FAQ_BADGES,
  FAQ_IS_FREE,
  FAQ_LAUNCH_TIME,
  FAQ_PAID,
  FAQ_REVENUE,
  FREE_LAUNCH_UPVOTES,
  LAUNCH_TIME_IST,
  LAUNCH_TIME_UTC,
  LINK_POLICY,
  REVENUE_PROVIDERS,
  SPOTLIGHT_PRICE,
  faqPageNode,
  type Faq,
} from "@/lib/seo/facts";

const PATH = "/product-hunt-alternative";
const PAGE_URL = `${SITE_URL}${PATH}`;
const TITLE = "Free Product Hunt Alternative for Daily Launches | The Launch Feed";
const DESCRIPTION =
  "Looking for a Product Hunt alternative? Launch your SaaS or AI tool free on The Launch Feed: daily 6:00 AM IST launches, community upvotes, winner badges and a permanent product page.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: PAGE_URL, type: "article", siteName: "The Launch Feed" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, creator: "@thelaunchfeed" },
};

const CHECKS: Array<{ q: string; a: string }> = [
  {
    q: "What does a launch cost?",
    a: `Nothing, if you add our badge to your site and upvote ${FREE_LAUNCH_UPVOTES} other new launches. Or pay once: $5 for Featured, $10 for Featured plus Spotlight.`,
  },
  { q: "When does my launch go live?", a: `${LAUNCH_TIME_IST} (${LAUNCH_TIME_UTC}) on the day you choose when you submit.` },
  { q: "How long does the listing stay up?", a: "Permanently. You keep the product page, your maker profile and a spot on your category page." },
  { q: "Is the link to my site dofollow?", a: "Yes on paid launches. Free launches keep the dofollow link while our badge stays on your site." },
  { q: "Does ranking last past launch day?", a: "Yes. Launches also compete on the weekly, monthly, yearly and all-time boards." },
  { q: "Can I show real traction?", a: `Optionally. Connect a read-only key from one of ${REVENUE_PROVIDERS.length} payment providers to show verified revenue.` },
  { q: "What do winners get?", a: "The top three of each day, week, month and year earn badges you can embed on your site or README." },
  { q: "Can I pay for more visibility?", a: `Yes: 30 days in the Featured ticker for $5, plus the Spotlight rail for $10, or the sidebar Spotlight alone at ${SPOTLIGHT_PRICE}.` },
  { q: "Can AI search tools read it?", a: "Every page has structured data, and /llms.txt lists live products in plain text for AI assistants." },
];

const FAQS: Faq[] = [
  {
    q: "What is the best free Product Hunt alternative?",
    a: `It depends on your audience, and most makers launch in more than one place. The Launch Feed is a good free option if you want a daily upvote board, a permanent product page with a link to your site, and winner badges. A free launch only asks you to add our badge and upvote ${FREE_LAUNCH_UPVOTES} other launches.`,
  },
  {
    q: "Can I launch on Product Hunt and The Launch Feed?",
    a: `Yes. Nothing stops you listing the same product in both places. Our day starts at ${LAUNCH_TIME_IST}, so you can launch here first, use the feedback to sharpen your tagline and screenshots, then launch elsewhere and link back to your Launch Feed page.`,
  },
  FAQ_IS_FREE,
  FAQ_LAUNCH_TIME,
  FAQ_BACKLINK,
  FAQ_PAID,
  FAQ_BADGES,
  FAQ_REVENUE,
];

export default function ProductHuntAlternativePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        ...webPageNode({ path: PATH, name: "A free Product Hunt alternative for daily launches", description: DESCRIPTION }),
        dateModified: CONTENT_UPDATED_ISO,
        about: { "@id": `${SITE_URL}#organization` },
      },
      { ...breadcrumb([{ name: "Home", url: SITE_URL }, { name: "Product Hunt alternative", url: PAGE_URL }]), "@id": `${PAGE_URL}#breadcrumb` },
      faqPageNode(PAGE_URL, FAQS),
    ],
  };

  return (
    <MainLayoutShell rails={false}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 text-ink">
        <Crumbs trail={[{ name: "Home", href: "/" }, { name: "Product Hunt alternative" }]} />

        <Card labelledBy="page-title">
          <h1 id="page-title" className="text-2xl sm:text-4xl font-semibold tracking-tight max-w-3xl">
            A free Product Hunt alternative for daily launches
          </h1>
          <p className="mt-2 text-xs text-ink-faint">
            Updated <time dateTime={CONTENT_UPDATED_ISO}>{CONTENT_UPDATED_LABEL}</time>
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-dim max-w-3xl">
            <strong className="text-ink font-semibold">
              The Launch Feed is a free place to launch software, SaaS and AI products on a daily upvote board.
            </strong>{" "}
            {withLaunchTime(
              `Like Product Hunt, makers post a product and the community upvotes it. Here, a new batch goes live every day at ${LAUNCH_TIME_IST} (${LAUNCH_TIME_UTC}), a free launch only asks you to add our badge and upvote ${FREE_LAUNCH_UPVOTES} other launches, and every product keeps a permanent page that links to its website.`,
            )}
          </p>
          <FactGrid
            facts={[
              { k: "Cost to launch", v: "Free, or $5 / $10 once" },
              { k: "Launch time", v: <>{withLaunchTime(`${LAUNCH_TIME_IST} daily`)}</> },
              { k: "Boards", v: "Day, week, month, year, all time" },
              { k: "Link to your site", v: "Dofollow (see below)" },
              { k: "Revenue proof", v: `${REVENUE_PROVIDERS.length} payment providers` },
              { k: "Extra visibility", v: "From $1 for 3 days" },
            ]}
          />
          <LaunchCta secondary={{ href: "/launch-guide", label: "Read the launch guide" }} />
        </Card>

        <Card labelledBy="checks-heading">
          <H2 id="checks-heading">What to check before you pick a launch site</H2>
          <p className="mt-2 text-sm text-ink-dim leading-relaxed max-w-3xl">
            These are the questions worth asking any launch platform. Here are our answers.
          </p>
          <div className="mt-4 -mx-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th scope="col" className="px-2 py-2 font-medium w-[38%]">Question</th>
                  <th scope="col" className="px-2 py-2 font-medium text-signal">The Launch Feed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {CHECKS.map((row) => (
                  <tr key={row.q} className="align-top">
                    <th scope="row" className="px-2 py-3 text-left font-semibold text-ink">{row.q}</th>
                    <td className="px-2 py-3 text-ink-dim">{withLaunchTime(row.a)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card labelledBy="both-heading">
          <H2 id="both-heading">Launch here and on Product Hunt</H2>
          <p className="mt-2 text-sm text-ink-dim leading-relaxed max-w-3xl">
            You don&apos;t have to choose one. Most makers spread a launch across several boards and communities. A simple
            order that works:
          </p>
          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { t: "Launch here first", d: `Go live at ${LAUNCH_TIME_IST}, collect early upvotes and comments, and earn a winner badge if you place in the top three.` },
              { t: "Tighten your pitch", d: "Use what people asked and praised to sharpen your tagline, screenshots and first comment." },
              { t: "Launch everywhere else", d: "Take the improved launch to other boards and communities, and link to your Launch Feed page as social proof." },
            ].map((s, i) => (
              <li key={s.t} className="rounded-xl border border-hairline p-5">
                <span className="font-display font-black text-3xl text-signal leading-none">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-semibold text-ink">{s.t}</h3>
                <p className="mt-1 text-sm text-ink-dim leading-relaxed">{withLaunchTime(s.d)}</p>
              </li>
            ))}
          </ol>
        </Card>

        <Card labelledBy="links-heading">
          <H2 id="links-heading">How the link to your site works</H2>
          <p className="mt-2 text-sm text-ink-dim leading-relaxed max-w-3xl">{LINK_POLICY}</p>
          <p className="mt-3 text-sm text-ink-dim leading-relaxed max-w-3xl">
            Your product also appears on its{" "}
            <Link href="/categories" className="text-signal hover:underline">category page</Link>, on the{" "}
            <Link href="/leaderboard/weekly" className="text-signal hover:underline">weekly</Link> and{" "}
            <Link href="/leaderboard/monthly" className="text-signal hover:underline">monthly</Link> boards while it ranks, and on
            your maker profile.
          </p>
        </Card>

        <FaqSection faqs={FAQS} />
      </article>
    </MainLayoutShell>
  );
}
