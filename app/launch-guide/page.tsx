import type { Metadata } from "next";
import Link from "next/link";
import MainLayoutShell from "@/app/MainLayoutShell";
import { withLaunchTime } from "@/components/ui/withLaunchTime";
import { Card, Crumbs, FaqSection, H2, LaunchCta } from "@/components/seo/LandingParts";
import { ORG_ID, SITE_URL, breadcrumb, webPageNode } from "@/lib/seo/schema";
import {
  CONTENT_UPDATED_ISO,
  CONTENT_UPDATED_LABEL,
  FAQ_AI_SEARCH,
  FAQ_BACKLINK,
  FAQ_IS_FREE,
  FAQ_WHAT_TO_LAUNCH,
  FREE_LAUNCH_UPVOTES,
  LAUNCH_TIME_IST,
  LINK_POLICY,
  faqPageNode,
  type Faq,
} from "@/lib/seo/facts";

const PATH = "/launch-guide";
const PAGE_URL = `${SITE_URL}${PATH}`;
const TITLE = "Where to Launch Your Startup: A Free Launch Plan | The Launch Feed";
const H1 = "Where to launch your product: a free plan for SaaS, AI tools and startups";
const DESCRIPTION =
  "Where to launch a startup, SaaS or AI tool for free: launch boards, founder communities and directories, a two-week launch plan, and how to tell which backlinks count.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: PAGE_URL, type: "article", siteName: "The Launch Feed" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, creator: "@thelaunchfeed" },
};

const PLACES: Array<{ type: string; good: string; check: string; examples: string }> = [
  {
    type: "Daily launch boards",
    good: "Launch-day upvotes, comments and a ranked badge",
    check: "Cost, launch time, and whether the listing stays up after the day ends",
    examples: "The Launch Feed, Product Hunt",
  },
  {
    type: "Founder communities",
    good: "Honest feedback from other makers",
    check: "Each community's self-promotion rules",
    examples: "Show HN on Hacker News, Indie Hackers, subreddits such as r/SaaS and r/SideProject",
  },
  {
    type: "Startup and SaaS directories",
    good: "A lasting listing people find through search",
    check: "Free tier, link type, and approval time",
    examples: "Directories that list products in your category",
  },
  {
    type: "AI tool directories",
    good: "People browsing specifically for AI tools",
    check: "Whether listings are reviewed, and whether the site still gets visits",
    examples: "Curated AI tool lists",
  },
  {
    type: "Your own channels",
    good: "People who already know you",
    check: "That every post links to one page, so you can see what worked",
    examples: "Newsletter, waitlist, X, LinkedIn, Bluesky",
  },
];

const PLAN: Array<{ when: string; t: string; d: string }> = [
  {
    when: "A week before",
    t: "Get the launch kit ready",
    d: "Write a one-line tagline that says what the product does, not how it feels. Prepare a square logo, three or more screenshots and a short demo video. Decide which page every link should point to.",
  },
  {
    when: "Day 1",
    t: "Launch on a daily board",
    d: `Submit to The Launch Feed for a ${LAUNCH_TIME_IST} slot. Reply to every comment that day and share the product page with your own audience.`,
  },
  {
    when: "Days 2 to 7",
    t: "Post in founder communities",
    d: "One community a day, written for that community. Lead with what you learned building it and ask for feedback rather than upvotes.",
  },
  {
    when: "Days 8 to 14",
    t: "List it where it lasts",
    d: "Submit to a handful of directories that fit your category, launch on other boards, and embed your badge on your site.",
  },
];

const FAQS: Faq[] = [
  {
    q: "Where should I launch my startup?",
    a: "Start where your first users already spend time. For most software that means a daily launch board, one or two founder communities and a few directories in your category. Launching in several places over two weeks usually beats one big day.",
  },
  {
    q: "How many places should I launch on?",
    a: "A handful you can actually show up for is better than a hundred you can't. Pick one launch board, two or three communities and a few directories that match your product, and reply to everyone who comments.",
  },
  {
    q: "Are startup directories still worth it?",
    a: "Relevant ones are. A directory helps when real people browse it and its link to you is dofollow and stays up. Check the link on a live listing before you count it, and skip sites that exist only to sell submissions.",
  },
  {
    q: "How do I check whether a backlink is dofollow?",
    a: "Open a live listing on the site, inspect the link to the product's website, and look at its rel attribute. If it includes nofollow, ugc or sponsored, it passes little or no ranking value.",
  },
  FAQ_IS_FREE,
  FAQ_BACKLINK,
  FAQ_WHAT_TO_LAUNCH,
  FAQ_AI_SEARCH,
];

export default function LaunchGuidePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      webPageNode({ path: PATH, name: H1, description: DESCRIPTION }),
      {
        "@type": "Article",
        "@id": `${PAGE_URL}#article`,
        headline: H1,
        description: DESCRIPTION,
        url: PAGE_URL,
        mainEntityOfPage: { "@id": `${PAGE_URL}#webpage` },
        image: `${PAGE_URL}/opengraph-image`,
        datePublished: CONTENT_UPDATED_ISO,
        dateModified: CONTENT_UPDATED_ISO,
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        inLanguage: "en",
      },
      { ...breadcrumb([{ name: "Home", url: SITE_URL }, { name: "Launch guide", url: PAGE_URL }]), "@id": `${PAGE_URL}#breadcrumb` },
      faqPageNode(PAGE_URL, FAQS),
    ],
  };

  return (
    <MainLayoutShell rails={false}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 text-ink">
        <Crumbs trail={[{ name: "Home", href: "/" }, { name: "Launch guide" }]} />

        <Card labelledBy="page-title">
          <h1 id="page-title" className="text-2xl sm:text-4xl font-semibold tracking-tight max-w-3xl">
            {H1}
          </h1>
          <p className="mt-2 text-xs text-ink-faint">
            Updated <time dateTime={CONTENT_UPDATED_ISO}>{CONTENT_UPDATED_LABEL}</time>
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-dim max-w-3xl">
            <strong className="text-ink font-semibold">Launch in a few places, not one.</strong> Start with a free daily
            launch board, share the launch in founder communities where your users already talk, then list the product in
            a handful of directories that fit its category. Spread this over about two weeks so each place gets your full
            attention, and point every link at one page so you can see what worked.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-dim max-w-3xl">
            {withLaunchTime(
              `On The Launch Feed, a launch is free: add our badge to your site, upvote ${FREE_LAUNCH_UPVOTES} other new launches, and your product goes live at ${LAUNCH_TIME_IST} on the day you pick.`,
            )}
          </p>
          <LaunchCta secondary={{ href: "/product-hunt-alternative", label: "Compare with Product Hunt" }} />
        </Card>

        <Card labelledBy="places-heading">
          <H2 id="places-heading">The five kinds of places to launch</H2>
          <div className="mt-4 -mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th scope="col" className="px-2 py-2 font-medium">Where</th>
                  <th scope="col" className="px-2 py-2 font-medium">Good for</th>
                  <th scope="col" className="px-2 py-2 font-medium">What to check</th>
                  <th scope="col" className="px-2 py-2 font-medium">Examples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {PLACES.map((p) => (
                  <tr key={p.type} className="align-top">
                    <th scope="row" className="px-2 py-3 text-left font-semibold text-ink">{p.type}</th>
                    <td className="px-2 py-3 text-ink-dim">{p.good}</td>
                    <td className="px-2 py-3 text-ink-dim">{p.check}</td>
                    <td className="px-2 py-3 text-ink-dim">{p.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card labelledBy="plan-heading">
          <H2 id="plan-heading">A two-week launch plan</H2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2">
            {PLAN.map((s) => (
              <li key={s.t} className="rounded-xl border border-hairline p-5">
                <p className="text-xs font-medium text-signal">{s.when}</p>
                <h3 className="mt-1.5 font-semibold text-ink">{s.t}</h3>
                <p className="mt-1 text-sm text-ink-dim leading-relaxed">{withLaunchTime(s.d)}</p>
              </li>
            ))}
          </ol>
        </Card>

        <Card labelledBy="backlinks-heading">
          <H2 id="backlinks-heading">Directories and backlinks: what actually counts</H2>
          <p className="mt-2 text-sm text-ink-dim leading-relaxed max-w-3xl">
            A directory link helps your search ranking when three things are true: the link is dofollow, the listing stays
            up, and the page gets visited and crawled. Many directories mark free listings nofollow or only link to you if
            you pay or show their badge, so check a live listing before you submit.
          </p>
          <p className="mt-3 text-sm text-ink-dim leading-relaxed max-w-3xl">{LINK_POLICY}</p>
        </Card>

        <Card labelledBy="types-heading">
          <H2 id="types-heading">Launching a SaaS or an AI tool</H2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-hairline p-5">
              <h3 className="font-semibold text-ink">SaaS products</h3>
              <p className="mt-1 text-sm text-ink-dim leading-relaxed">
                Buyers want proof the product is used. Connect a read-only key from your payment provider to show verified
                revenue on your product page, and choose{" "}
                <Link href="/category/saas" className="text-signal hover:underline">SaaS</Link> or{" "}
                <Link href="/category/dev-tools" className="text-signal hover:underline">Developer Tools</Link> as your
                category.
              </p>
            </div>
            <div className="rounded-xl border border-hairline p-5">
              <h3 className="font-semibold text-ink">AI tools</h3>
              <p className="mt-1 text-sm text-ink-dim leading-relaxed">
                Say what the tool does in plain words; &ldquo;AI-powered&rdquo; alone tells nobody anything. Launch in{" "}
                <Link href="/category/ai" className="text-signal hover:underline">AI &amp; Machine Learning</Link> so the
                product is listed there, and in our{" "}
                <a href="/llms.txt" className="text-signal hover:underline">llms.txt</a> file that AI assistants read.
              </p>
            </div>
          </div>
        </Card>

        <FaqSection faqs={FAQS} />
      </article>
    </MainLayoutShell>
  );
}
