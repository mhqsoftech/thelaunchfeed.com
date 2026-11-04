import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDelistedSections, GENUINE_PRODUCT_FILTER } from "@/lib/queries/products";
import {
  ANSWER_SUMMARY,
  FREE_LAUNCH_RULES,
  LAUNCH_TIME_IST,
  LAUNCH_TIME_UTC,
  LINK_POLICY,
  PAID_OPTIONS,
  REVENUE_PROVIDERS,
  SPOTLIGHT_PRICE,
} from "@/lib/seo/facts";

export const dynamic = "force-dynamic";
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET() {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

  const delistedSections = await getDelistedSections();
  const isFeedDelisted = delistedSections.includes("all");

  const [products, founders, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: "LIVE",
        ...(isFeedDelisted ? GENUINE_PRODUCT_FILTER : {}),
      },
          select: {
            id: true,
            slug: true,
            name: true,
            tagline: true,
            description: true,
            websiteUrl: true,
            voteCount: true,
            launchedAt: true,
            tags: true,
            category: { select: { name: true, slug: true } },
            owner: { select: { name: true, username: true, title: true } },
            details: true,
          },
          orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
          take: 200,
        }),
    prisma.user.findMany({
      where: { isProfilePublic: true },
      select: {
        id: true,
        name: true,
        username: true,
        title: true,
        bio: true,
        twitterHandle: true,
        githubHandle: true,
        products: {
          where: { status: "LIVE" },
          select: { name: true, slug: true },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.category.findMany({
      select: { name: true, slug: true, _count: { select: { products: { where: { status: "LIVE" } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const lines: string[] = [
    `# The Launch Feed`,
    ``,
    `> ${ANSWER_SUMMARY}`,
    ``,
    `## Key facts`,
    `- Website: ${siteUrl}`,
    `- What it is: a free daily launch board and leaderboard for software, SaaS, AI tools and startups; often used as a Product Hunt alternative.`,
    `- Launch time: every day at ${LAUNCH_TIME_IST} (${LAUNCH_TIME_UTC}). Voting runs 24 hours; the top three are frozen into the daily hall of fame.`,
    `- Boards: daily (home page), weekly, monthly, yearly and all-time.`,
    `- Free launch: ${FREE_LAUNCH_RULES}`,
    `- Paid options: ${PAID_OPTIONS}`,
    `- Link to the maker's site: ${LINK_POLICY}`,
    `- Verified revenue (optional): read-only connections to ${REVENUE_PROVIDERS.join(", ")}.`,
    `- Winner badges: the top three of each day, week, month and year earn embeddable badges; every product has a live ranking badge.`,
    `- Launch announcements: Telegram, WhatsApp and Bluesky.`,
    ``,
    `## Guides`,
    `- [Where to launch your product](${siteUrl}/launch-guide): free launch plan covering launch boards, founder communities, directories and backlinks.`,
    `- [Product Hunt alternative](${siteUrl}/product-hunt-alternative): how The Launch Feed works as a free Product Hunt alternative, with an FAQ.`,
    ``,
    `## Main pages`,
    `- [Today's launches](${siteUrl}/): the live daily leaderboard.`,
    `- [Best of the week](${siteUrl}/leaderboard/weekly)`,
    `- [Best of the month](${siteUrl}/leaderboard/monthly)`,
    `- [Best of the year](${siteUrl}/leaderboard/yearly)`,
    `- [All-time hall of fame](${siteUrl}/leaderboard/all-time)`,
    `- [Submit a product](${siteUrl}/submit): launch free or pick a paid option.`,
    `- [Book the sidebar Spotlight](${siteUrl}/spotlight/book): ${SPOTLIGHT_PRICE}.`,
    `- [Winner badges](${siteUrl}/badges)`,
    `- [Categories](${siteUrl}/categories)`,
    `- [Top founders](${siteUrl}/founders)`,
    `- [About](${siteUrl}/about)`,
    `- [Contact](${siteUrl}/contact)`,
    `- [Full product details for AI](${siteUrl}/llms-full.txt)`,
    `- [Sitemap](${siteUrl}/sitemap.xml)`,
    ``,
    `## Categories`,
  ];

  for (const cat of categories) {
    if (cat._count.products === 0) continue;
    lines.push(`- [${cat.name}](${siteUrl}/category/${cat.slug}): ${cat._count.products} live products`);
  }

  lines.push(``, `## Top products by upvotes`);

  if (products.length === 0) {
    lines.push(`- No products currently published or active in the feed.`);
  } else {
    for (const p of products) {
      const makerName = p.owner.name || p.owner.username;
      const details = (p.details as any) || {};
      const tech = details.techStack ? ` · Tech: ${details.techStack}` : "";
      lines.push(
        `- [${p.name}](${siteUrl}/product/${p.slug}) (${p.voteCount} upvotes): ${p.tagline}. Built by ${makerName} (@${p.owner.username}). Category: ${p.category?.name || "General"}${tech}`
      );
    }
  }

  lines.push(``, `## Founders`);

  for (const f of founders) {
    const displayName = f.name || f.username;
    const prods = f.products.map((pr) => pr.name).join(", ");
    const prodStr = prods ? ` · Creator of ${prods}` : "";
    const titleStr = f.title ? ` (${f.title})` : "";
    lines.push(
      `- [${displayName} (@${f.username})](${siteUrl}/founder/${f.username})${titleStr}${prodStr}`
    );
  }

  lines.push(``, `## Official channels`);
  lines.push(`- X: https://x.com/thelaunchfeed`);
  lines.push(`- Bluesky: https://bsky.app/profile/thelaunchfeed.bsky.social`);
  lines.push(`- Telegram: https://t.me/thelaunchfeed`);
  lines.push(`- WhatsApp Community: https://chat.whatsapp.com/HxTenCRhtHa9PIviuQNl9U`);
  lines.push(`- Submit Launch: ${siteUrl}/submit`);
  lines.push(``);

  const markdownContent = lines.join("\n");

  return new NextResponse(markdownContent, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
