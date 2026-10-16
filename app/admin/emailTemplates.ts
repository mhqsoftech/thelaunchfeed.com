/**
 * Email templates for The Launch Feed.
 *
 * Each template describes its content as data; lib/email/layout.ts renders
 * the branded HTML (table-based, inline styles, dark-mode aware) and the
 * matching plain-text body. Every link is absolute and built from
 * NEXT_PUBLIC_APP_URL via absUrl().
 */

import { renderEmail, absUrl, type EmailContent } from "@/lib/email/layout";

export type EmailTemplateId =
  | "welcome"
  | "product-submitted"
  | "product-approved"
  | "product-rejected"
  | "product-launched"
  | "rank-top3"
  | "rank-first"
  | "weekly-digest"
  | "featured-expiring"
  | "revenue-verified"
  | "comment-received"
  | "custom-broadcast"
  | "directory-founder-invite";

export type EmailTrigger =
  | "manual"
  | "on-signup"
  | "on-submit"
  | "on-approve"
  | "on-reject"
  | "on-launch"
  | "on-rank-change"
  | "on-rank-first"
  | "weekly-cron"
  | "on-slot-expiring"
  | "on-revenue-verified"
  | "on-comment"
  | "on-directory-crawl";

export interface EmailTemplate {
  id: EmailTemplateId;
  name: string;
  description: string;
  trigger: EmailTrigger;
  auto: boolean;
  subject: (v: TemplateVars) => string;
  render: (v: TemplateVars) => string;
  /** Plain-text alternative sent alongside the HTML. */
  text: (v: TemplateVars) => string;
}

export interface TemplateVars {
  [key: string]: unknown;
  userName?: string;
  userEmail?: string;
  founderName?: string;
  sourceDirectory?: string;
  productName?: string;
  productSlug?: string;
  rank?: number;
  period?: "daily" | "weekly" | "monthly";
  revenueLabel?: string;
  slotExpiresOn?: string;
  rejectionReason?: string;
  digestItems?: { name: string; tagline: string; votes: number }[];
  customBody?: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

type TemplateDef = Omit<EmailTemplate, "render" | "text"> & {
  content: (v: TemplateVars) => EmailContent;
};

function define(def: TemplateDef): EmailTemplate {
  const { content, ...meta } = def;
  return {
    ...meta,
    render: (v) => renderEmail(content(v)).html,
    text: (v) => renderEmail(content(v)).text,
  };
}

/* ─────────── shared bits ─────────── */

const productPath = (v: TemplateVars) =>
  v.productSlug ? `/product/${encodeURIComponent(v.productSlug)}` : "/";

const badgeDownloadPath = (v: TemplateVars, award: string) =>
  v.productSlug
    ? `/api/badge/${encodeURIComponent(v.productSlug)}?award=${encodeURIComponent(award)}&download=true`
    : "/badges";

const makerReason = (v: TemplateVars) =>
  `You're receiving this because you're the maker of ${v.productName ?? "a product"} on The Launch Feed.`;

const ACCOUNT_REASON = "You're receiving this because you have an account on The Launch Feed.";

const periodOf = (v: TemplateVars) => v.period ?? "daily";

/* ─────────── templates ─────────── */

export const TEMPLATES: EmailTemplate[] = [
  define({
    id: "welcome",
    name: "Welcome",
    description: "Sent when a new user signs up. Onboards them into the leaderboards.",
    trigger: "on-signup",
    auto: true,
    subject: (v) => `Welcome to The Launch Feed, ${v.userName ?? "maker"}`,
    content: (v) => ({
      preheader: "Your founder account is ready. Here's how to land your first launch.",
      eyebrow: "Welcome",
      heading: `Welcome, ${v.userName ?? "maker"}.`,
      intro: [
        "You now have a founder profile on The Launch Feed, a leaderboard for indie software launches. Every product competes on **Today**, **This Week** and **This Month** at the same time, and top finishers are archived in the Hall of Fame.",
      ],
      list: {
        title: "Get to #1: the playbook",
        items: [
          "Submit with a sharp tagline (about 60 characters) and one clean screenshot.",
          "Pick a slot when your audience is awake. Tue–Thu around 12:00 UTC works well.",
          "Line up friendly upvoters for the first six hours. That window sets the ranking curve.",
          "Reply to every comment on launch day. Engagement is scored, not just votes.",
          "Connect Stripe, Polar or LemonSqueezy to earn the verified revenue badge.",
        ],
      },
      cta: { label: "Submit your first product", url: "/submit" },
      secondary: [
        { label: "Browse today's board", url: "/" },
        { label: "Profile settings", url: "/profile" },
      ],
      outro: [
        `Signed up as **${v.userEmail ?? "your email"}**. Your profile is public by default; you can hide revenue or make it private from your profile settings.`,
      ],
      reason: "You're receiving this because you just created an account on The Launch Feed.",
      community: true,
    }),
  }),

  define({
    id: "product-submitted",
    name: "Submission received",
    description: "Confirms a submission is queued and explains the review + release timing.",
    trigger: "on-submit",
    auto: true,
    subject: (v) => `${v.productName ?? "Your product"} is queued for launch`,
    content: (v) => ({
      preheader: `Your ${v.productName ?? "product"} submission is in the queue.`,
      eyebrow: "Submission received",
      heading: "You're in the queue.",
      intro: [
        `Thanks for submitting **${v.productName ?? "your product"}**. We review every submission for basic quality (working link, real product, no spam), then release it on the Today board at its scheduled time.`,
      ],
      details: [
        ["Product", v.productName ?? "—"],
        ["Founder", v.userName ?? "—"],
        ["Status", "Queued for review"],
        ["Scheduled release", v.slotExpiresOn ?? "Within 24h"],
      ],
      list: {
        title: "What happens next",
        items: [
          "We review it within a few hours. If anything's unclear, we'll email you.",
          "At release time it goes live on the Today board and starts collecting votes.",
          "You'll get an email the moment it's live, and another if it reaches the top three.",
        ],
      },
      cta: { label: "View submission status", url: "/profile" },
      secondary: [{ label: "Submit another product", url: "/submit" }],
      outro: [
        "While you wait: draft the post you'll share at launch, tell your community the launch time in their timezone, and point launch traffic at a dedicated landing page.",
      ],
      reason: makerReason(v),
      community: true,
    }),
  }),

  define({
    id: "product-approved",
    name: "Submission approved",
    description: "Sent when a product clears moderation and is locked into a slot.",
    trigger: "on-approve",
    auto: true,
    subject: (v) => `Approved: ${v.productName} launches ${v.slotExpiresOn ?? "soon"}`,
    content: (v) => ({
      preheader: `${v.productName ?? "Your product"} is approved and scheduled.`,
      eyebrow: "Approved",
      eyebrowTone: "verified",
      heading: "Cleared for launch.",
      intro: [
        `**${v.productName ?? "Your product"}** passed moderation and is locked into its launch slot. When the countdown ends it enters the Today board and makers on The Launch Feed are notified.`,
      ],
      details: [
        ["Product", v.productName ?? "—"],
        ["Slot", v.slotExpiresOn ?? "—"],
        ["Board", "Today, on release"],
      ],
      list: {
        title: "Before launch",
        items: [
          "Double-check your product URL. Dead links are the top reason launches get flagged.",
          "Add a launch-day banner to your homepage that links to your Launch Feed page.",
          "Draft a first comment that introduces the product and asks a question.",
        ],
      },
      cta: { label: "Open your dashboard", url: "/profile" },
      secondary: [{ label: "Preview product page", url: productPath(v) }],
      reason: makerReason(v),
      community: true,
    }),
  }),

  define({
    id: "product-rejected",
    name: "Submission rejected",
    description: "Sent when a submission fails moderation. Includes the admin's reason.",
    trigger: "on-reject",
    auto: true,
    subject: (v) => `Update on your ${v.productName ?? "product"} submission`,
    content: (v) => ({
      preheader: `${v.productName ?? "Your submission"} wasn't approved. Reviewer notes inside.`,
      eyebrow: "Submission update",
      heading: "Your submission wasn't approved.",
      intro: [
        `Thanks for submitting **${v.productName ?? "your product"}**. After review we can't add it to the launchpad in its current form. The notes below explain why, and we'd be glad to see a resubmission once they're addressed.`,
      ],
      callout: {
        title: "Reviewer notes",
        body: v.rejectionReason ?? "No specific reason was provided.",
        tone: "signal",
      },
      list: {
        title: "What to do next",
        items: [
          "Address the notes above, then submit an updated version. Revisions are accepted right away.",
          "If you disagree, reply to this email and a person will review your appeal.",
          "Check the submission rules in our terms to see the criteria we apply.",
        ],
      },
      cta: { label: "Submit a revision", url: "/submit" },
      secondary: [{ label: "Submission guidelines", url: "/terms" }],
      reason: makerReason(v),
    }),
  }),

  define({
    id: "product-launched",
    name: "Product launched",
    description: "Fires the moment a product goes live. Sent to the maker AND to every user.",
    trigger: "on-launch",
    auto: true,
    subject: (v) => `${v.productName} just launched on The Launch Feed`,
    content: (v) => ({
      preheader: `${v.productName ?? "Your product"} is live on today's board.`,
      eyebrow: "Live now",
      heading: `${v.productName ?? "Your product"} is live.`,
      intro: [
        `**${v.productName ?? "Your product"}** just went live on the Today board. Votes and comments in the first six hours carry the most weight, so this is the window that decides whether a launch finishes in the top three.`,
      ],
      list: {
        title: "First-hour checklist",
        items: [
          "Share the direct product link, not the homepage, in every announcement.",
          "Post in one high-signal community (Indie Hackers, r/SaaS, Show HN) with an honest ask.",
          "Reply to the first comments within 15 minutes. Response time is scored.",
          "Screenshot your ranking when you hit the top 10 and share it.",
        ],
      },
      cta: { label: "Open the launch page", url: productPath(v) },
      secondary: [
        { label: "Today's leaderboard", url: "/" },
        { label: "Download launch badge", url: badgeDownloadPath(v, "launch") },
      ],
      outro: [
        "Your launch page has embed codes for official Launch Feed badges. Add one to your site, landing page or GitHub README for social proof and extra upvotes.",
      ],
      reason: makerReason(v),
      community: true,
    }),
  }),

  define({
    id: "rank-top3",
    name: "Ranked top 3",
    description: "Notifies makers whenever their product enters the top 3 on any board.",
    trigger: "on-rank-change",
    auto: true,
    subject: (v) => `#${v.rank ?? 3} on the ${periodOf(v)} board — ${v.productName}`,
    content: (v) => {
      const rank = v.rank ?? 3;
      return {
        preheader: `You're #${rank}. Keep the momentum for the next few hours.`,
        eyebrow: `Rank #${rank} · ${periodOf(v)}`,
        heading: `Top ${rank} on the ${periodOf(v)} board.`,
        intro: [
          `**${v.productName ?? "Your product"}** is ranked **#${rank}** on the ${periodOf(v)} leaderboard. Most launches never crack the top ten, so this is a real signal that your positioning and community are working.`,
        ],
        list: {
          title: "Hold, or climb, from here",
          items: [
            "Reply to every open comment on your product page. Fast replies lift your engagement score.",
            "Ask a few specific users for an honest review. Reviews weigh more than raw upvotes.",
            `Share the ranking: "we're #${rank} today" converts better than the original launch post.`,
          ],
        },
        cta: { label: "View your placement", url: productPath(v) },
        secondary: [
          { label: "Download badge", url: badgeDownloadPath(v, `${periodOf(v)}_${v.rank ?? 2}`) },
          { label: "See the leaderboard", url: "/" },
        ],
        reason: makerReason(v),
        community: true,
      };
    },
  }),

  define({
    id: "rank-first",
    name: "Ranked #1",
    description: "Celebration email for a #1 finish. Includes badge details and next-day perks.",
    trigger: "on-rank-first",
    auto: true,
    subject: (v) => `#1 today: ${v.productName}`,
    content: (v) => ({
      preheader: `${v.productName ?? "Your product"} topped the ${periodOf(v)} board.`,
      eyebrow: `#1 · ${periodOf(v)}`,
      heading: `#1 on the ${periodOf(v)} board.`,
      intro: [
        `**${v.productName ?? "Your product"}** is the top launch on The Launch Feed right now. A **#1 badge** is on your product page, your founder profile shows a top-of-board marker, and you're eligible for this week's recap email.`,
      ],
      list: {
        title: "Ride the wave",
        items: [
          "Add a \"#1 on The Launch Feed\" banner to your homepage while the ranking holds.",
          "Screenshot the leaderboard and pin it on socials. This is the most shareable moment of the launch.",
          "Thank the people who commented personally. That's how commenters become customers.",
        ],
      },
      cta: { label: "View your #1 placement", url: productPath(v) },
      secondary: [
        { label: "Download badge", url: badgeDownloadPath(v, `${periodOf(v)}_1`) },
        { label: "Book a featured slot", url: "/profile" },
      ],
      reason: makerReason(v),
      community: true,
    }),
  }),

  define({
    id: "weekly-digest",
    name: "Weekly digest",
    description: "Monday recap of the week's top launches, revenue milestones, and new makers.",
    trigger: "weekly-cron",
    auto: true,
    subject: () => `This week on The Launch Feed`,
    content: (v) => {
      const items =
        v.digestItems && v.digestItems.length
          ? v.digestItems
          : [
              { name: "Synthwave", tagline: "AI code review", votes: 342 },
              { name: "Gridlock", tagline: "Zero-downtime DB deploys", votes: 310 },
              { name: "Pixelform", tagline: "Figma to React", votes: 298 },
              { name: "Chronos", tagline: "Time tracking that doesn't suck", votes: 275 },
              { name: "Neonbase", tagline: "Serverless Postgres for indie hackers", votes: 260 },
            ];
      return {
        preheader: "This week's top launches and a few shipping tips.",
        eyebrow: "Weekly digest",
        heading: "The week in launches.",
        intro: [
          "Here are the products that topped the boards this week. If you launched, thanks for shipping.",
        ],
        table: {
          title: "Top launches this week",
          rows: items.map((i) => ({ name: i.name, tagline: i.tagline, value: `▲ ${i.votes}` })),
        },
        cta: { label: "Explore the full week", url: "/leaderboard/weekly" },
        secondary: [{ label: "Submit next week's launch", url: "/submit" }],
        outro: [
          "Something we've noticed: products that reply to comments within 10 minutes finish higher, and Tue/Wed slots around 12:00–14:00 UTC consistently outperform the rest.",
        ],
        reason: ACCOUNT_REASON,
        unsubscribe: true,
        community: true,
      };
    },
  }),

  define({
    id: "featured-expiring",
    name: "Featured slot expiring",
    description: "Reminder 3 days before a paid featured slot ends. Includes renewal offer.",
    trigger: "on-slot-expiring",
    auto: true,
    subject: (v) => `Your featured slot for ${v.productName} expires ${v.slotExpiresOn}`,
    content: (v) => ({
      preheader: `${v.productName ?? "Your product"}'s featured placement ends ${v.slotExpiresOn ?? "soon"}.`,
      eyebrow: "Featured slot",
      heading: "Your featured slot is ending.",
      intro: [
        `**${v.productName ?? "Your product"}**'s featured placement ends on **${v.slotExpiresOn ?? "soon"}**. After that, the slot goes to the next maker on the waitlist.`,
      ],
      details: [
        ["Product", v.productName ?? "—"],
        ["Placement", "Top featured"],
        ["Ends on", v.slotExpiresOn ?? "—"],
        ["Renewal", "$99 / month"],
      ],
      list: {
        title: "Renewing keeps",
        items: [
          "30 more days in the featured spot, visible across the site.",
          "Priority in the rotating spotlight row.",
          "Impression and click-through analytics for the slot.",
        ],
      },
      cta: { label: "Renew for $99/mo", url: `/profile?renew=${encodeURIComponent(v.productSlug ?? "")}` },
      secondary: [{ label: "Compare placement options", url: "/submit" }],
      reason: makerReason(v),
    }),
  }),

  define({
    id: "revenue-verified",
    name: "Revenue verified",
    description: "Confirms a maker's MRR was verified via Stripe/Polar/LemonSqueezy.",
    trigger: "on-revenue-verified",
    auto: true,
    subject: (v) => `Verified: ${v.revenueLabel} on ${v.productName}`,
    content: (v) => ({
      preheader: `${v.revenueLabel ?? "Revenue"} verified on ${v.productName ?? "your product"}.`,
      eyebrow: "Revenue verified",
      eyebrowTone: "verified",
      heading: `Revenue verified for ${v.productName ?? "your product"}.`,
      intro: [
        `We verified live revenue data for **${v.productName ?? "your product"}**. A verified badge now appears next to it on the daily, weekly and monthly boards.`,
      ],
      details: [
        ["Product", v.productName ?? "—"],
        ["Verified figure", v.revenueLabel ?? "MRR"],
        ["Refreshes", "Every 24 hours"],
      ],
      cta: { label: "View verified badge", url: productPath(v) },
      secondary: [
        { label: "Download MRR badge", url: badgeDownloadPath(v, "revenue") },
        { label: "Display settings", url: "/profile" },
      ],
      outro: [
        "Prefer to hide the exact figure? Switch the display to **rounded**, **range** or **hidden** in your profile. The badge stays verified either way.",
      ],
      reason: makerReason(v),
    }),
  }),

  define({
    id: "comment-received",
    name: "New comment",
    description: "Sent when a maker's product gets a new comment. Includes a reply CTA.",
    trigger: "on-comment",
    auto: false,
    subject: (v) => `New comment on ${v.productName}`,
    content: (v) => ({
      preheader: `New comment on ${v.productName ?? "your product"}. Reply while it's live.`,
      eyebrow: "New comment",
      heading: "Someone left a comment.",
      intro: [
        `A new comment landed on **${v.productName ?? "your product"}**. Fast replies during a launch (under 10 minutes is the target) are one of the strongest signals in our ranking.`,
      ],
      cta: { label: "Read & reply", url: `${productPath(v)}#comments` },
      outro: [
        "Answer the question first, then thank them. If it's critical, reply calmly and publicly. Silence hurts more than criticism.",
      ],
      reason: makerReason(v),
    }),
  }),

  define({
    id: "custom-broadcast",
    name: "Custom broadcast",
    description: "Free-form message from the admin. Full themed shell, custom body + CTA.",
    trigger: "manual",
    auto: false,
    subject: () => `A note from The Launch Feed`,
    content: (v) => ({
      preheader: v.customBody?.slice(0, 90) || "A message from The Launch Feed.",
      eyebrow: "Announcement",
      heading: "A note from The Launch Feed",
      intro: [],
      callout: { title: "Message", body: v.customBody ?? "Hello from The Launch Feed.", tone: "neutral" },
      cta: v.ctaUrl
        ? { label: v.ctaLabel ?? "Open", url: absUrl(v.ctaUrl) }
        : { label: "Visit The Launch Feed", url: "/" },
      reason: ACCOUNT_REASON,
      unsubscribe: true,
      community: true,
    }),
  }),

  define({
    id: "directory-founder-invite",
    name: "Directory Founder Outreach",
    description:
      "Invites founders discovered across product directories (Uneed, Product Hunt, Microlaunch, etc.) to launch on The Launch Feed freely with unique features.",
    trigger: "manual",
    auto: false,
    subject: (v) =>
      `Featured ${v.productName || "your product"} on ${v.sourceDirectory || "directories"}? Launch on The Launch Feed (100% Free)`,
    content: (v) => {
      const prodName = v.productName || "your product";
      const founderName = v.founderName || "there";
      const srcDir = v.sourceDirectory || "product directories";
      return {
        preheader: `We noticed ${prodName} on ${srcDir}. Launch it free on The Launch Feed.`,
        eyebrow: "Founder invitation · free",
        heading: `Launch ${prodName} on The Launch Feed`,
        intro: [
          `Hey ${founderName},`,
          `We came across **${prodName}** on **${srcDir}** and liked what you're building. We'd love for you to launch it on **The Launch Feed**, a founder-first discovery platform with a live daily leaderboard. It's free.`,
        ],
        list: {
          title: "What you get",
          items: [
            "**Launch broadcast:** your launch is posted to our Bluesky feed, WhatsApp community and Telegram channel.",
            "**Live leaderboards and badges:** daily, weekly and monthly boards with embeddable winner badges.",
            "**Fast indexing:** new launches and maker profiles are submitted to Google and IndexNow within hours.",
            "**Verified revenue:** optional one-click MRR verification with Stripe, DodoPayments, Polar, Paddle or LemonSqueezy.",
            "**Free forever:** no paid queue skipping and no hidden fees.",
          ],
        },
        cta: { label: `Submit ${prodName} for free`, url: "/submit" },
        secondary: [{ label: "Explore the live feed", url: "/" }],
        outro: ["Questions? Just reply to this email."],
        reason: `You're receiving this one-time invitation because ${prodName} is listed on ${srcDir}.`,
        unsubscribe: true,
      };
    },
  }),
];

export function getTemplate(id: EmailTemplateId) {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
