/**
 * Plain-language facts about how The Launch Feed works, shared by the landing
 * pages, the home FAQ and llms.txt so search and AI engines read the same
 * answer everywhere. Every line must stay true to the code:
 *   - free-launch rules: lib/free-launch.ts (badge check, nightly link audit)
 *   - paid tiers: app/submit/SubmitClientView.tsx ($5 / $10, 30 days)
 *   - sidebar Spotlight: lib/rail-spotlight-shared.ts ($1 per 3 days)
 *   - revenue providers: lib/revenue/index.ts (ADAPTERS)
 * Strings use "6:00 AM IST" so withLaunchTime() can localise them on screen.
 * Client-safe: the home FAQ imports this, so no server-only imports here.
 */

import { RAIL_DAYS_PER_BLOCK, RAIL_PRICE_PER_BLOCK_CENTS } from "@/lib/rail-spotlight-shared";

/** Upvotes a free launch must give; lib/free-launch.ts enforces this value. */
export const FREE_LAUNCH_UPVOTES = 3;

export const LAUNCH_TIME_IST = "6:00 AM IST";
export const LAUNCH_TIME_UTC = "00:30 UTC";

/** Display names for every provider in lib/revenue ADAPTERS. */
export const REVENUE_PROVIDERS = [
  "Stripe",
  "Paddle",
  "Lemon Squeezy",
  "Polar",
  "Dodo Payments",
  "Razorpay",
  "Paystack",
  "Chargebee",
  "RevenueCat",
  "Gumroad",
  "FastSpring",
  "Square",
  "Creem",
] as const;

export const SPOTLIGHT_PRICE = `$${RAIL_PRICE_PER_BLOCK_CENTS / 100} per product for ${RAIL_DAYS_PER_BLOCK} days`;

export const ANSWER_SUMMARY =
  `The Launch Feed is a free daily launch board for new software, SaaS and AI products. A new batch goes live every day at ${LAUNCH_TIME_IST} (${LAUNCH_TIME_UTC}), the maker community upvotes for 24 hours, and the top three are kept in the daily hall of fame. Launches also rank on weekly, monthly, yearly and all-time boards.`;

export const FREE_LAUNCH_RULES =
  `A free launch costs nothing. Before it goes live you add our badge to your website and upvote ${FREE_LAUNCH_UPVOTES} other new launches.`;

export const LINK_POLICY =
  "Every product page links to the maker's website. Free launches keep a dofollow link while our badge stays on the site; we re-check badges regularly and switch the link to nofollow if the badge is removed. Paid launches always get a dofollow link.";

export const PAID_OPTIONS =
  `Paid options are one-time: $5 puts you in the Featured ticker on every page for 30 days, and $10 adds 30 days in the Spotlight rail as well. Both go live as soon as payment clears and skip the badge and upvote steps. The sidebar Spotlight on its own is ${SPOTLIGHT_PRICE}.`;

export type Faq = { q: string; a: string; /** Optional internal link shown under the answer. */ link?: { href: string; label: string } };

export const FAQ_IS_FREE: Faq = {
  q: "Is it free to launch a product on The Launch Feed?",
  a: `Yes. ${FREE_LAUNCH_RULES} If you'd rather skip those steps, the $5 and $10 launches go live as soon as payment clears.`,
  link: { href: "/submit", label: "Launch your product" },
};

export const FAQ_BACKLINK: Faq = {
  q: "Do I get a dofollow backlink?",
  a: LINK_POLICY,
};

export const FAQ_LAUNCH_TIME: Faq = {
  q: "When do launches go live?",
  a: `Every day at ${LAUNCH_TIME_IST}, which is ${LAUNCH_TIME_UTC}. You pick the launch day when you submit. Voting runs for 24 hours, then the day's top three are frozen into the hall of fame.`,
};

export const FAQ_PH_ALTERNATIVE: Faq = {
  q: "Is The Launch Feed a Product Hunt alternative?",
  a: "Yes. It works the same basic way: makers post a product, the community upvotes, and the best launches rank on a daily board. You can launch here for free, on a different daily clock, and keep a permanent product page with a link to your site. Many makers launch in several places, so you don't have to pick one.",
  link: { href: "/product-hunt-alternative", label: "How it compares" },
};

export const FAQ_WHAT_TO_LAUNCH: Faq = {
  q: "What kinds of products can I launch?",
  a: "Software of any size: SaaS apps, AI tools, developer tools, open-source projects, mobile apps and indie side projects. You choose a category when you submit, and the product is listed on that category page too.",
  link: { href: "/categories", label: "Browse categories" },
};

export const FAQ_REVENUE: Faq = {
  q: "How does verified revenue work?",
  a: `You can connect a read-only key from ${REVENUE_PROVIDERS.length} payment providers, including ${REVENUE_PROVIDERS.slice(0, 5).join(", ")}. We read your revenue directly from the provider and show a verified badge on your product page. It is optional; nothing is estimated or self-reported.`,
};

export const FAQ_BADGES: Faq = {
  q: "What do the top three launches get?",
  a: "The top three of each day, week, month and year earn winner badges you can embed on your site or GitHub README. Every product also gets a live ranking badge that updates as it climbs.",
  link: { href: "/badges", label: "See winner badges" },
};

export const FAQ_PAID: Faq = {
  q: "What do the paid launch options include?",
  a: PAID_OPTIONS,
  link: { href: "/spotlight/book", label: "Book a Spotlight slot" },
};

export const FAQ_AI_SEARCH: Faq = {
  q: "Will AI assistants like ChatGPT or Perplexity see my launch?",
  a: "Every product page has structured data, and the site publishes plain-text summaries at /llms.txt and /llms-full.txt that list live products with their tagline, category and maker. That makes launches easy for AI search tools to read and cite, though no site can guarantee a citation.",
};

/** The FAQ every launch-intent page can draw from, in priority order. */
export const CORE_FAQS: Faq[] = [
  FAQ_IS_FREE,
  FAQ_LAUNCH_TIME,
  FAQ_BACKLINK,
  FAQ_PH_ALTERNATIVE,
  FAQ_WHAT_TO_LAUNCH,
  FAQ_PAID,
  FAQ_BADGES,
  FAQ_REVENUE,
  FAQ_AI_SEARCH,
];

/** FAQPage JSON-LD for a list of FAQs on the page at `url`. */
export const faqPageNode = (url: string, faqs: Faq[]) => ({
  "@type": "FAQPage",
  "@id": `${url}#faq`,
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

/** Last content review of the landing pages; bump when their copy changes. */
export const CONTENT_UPDATED_ISO = "2026-11-05";
export const CONTENT_UPDATED_LABEL = "November 5, 2026";
