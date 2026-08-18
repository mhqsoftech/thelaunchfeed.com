import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDelistedSections, GENUINE_PRODUCT_FILTER } from "@/lib/queries/products";

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
      select: { name: true, slug: true, _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const lines: string[] = [
    `# The Launch Feed (thelaunchfeed.com)`,
    `> The daily software and AI product leaderboard featuring 360-degree technical architecture intelligence, founder manifestos, and verified revenue transparency.`,
    ``,
    `## Platform Overview & Publishing Architecture`,
    `- Website: ${siteUrl}`,
    `- Daily Release Schedule: Every day at 06:00:00 AM IST (00:30:00 UTC). All queued products launch synchronously worldwide.`,
    `- Multi-Channel Social Broadcast: Automatic instant publication to 𝕏 (Twitter), Telegram, and WhatsApp broadcast channels upon release.`,
    `- 360° Product Intelligence Suite: Every product listing documents Executive Pitch, Core Features, Tech Stack, Infrastructure Mesh, OpenAPI Endpoints, Security Standards, Founder Thesis, and Release Milestones.`,
    `- Complete Raw 360° Specs Knowledge Base: ${siteUrl}/llms-full.txt`,
    `- Dynamic XML Sitemap: ${siteUrl}/sitemap.xml`,
    ``,
    `## Core Platform Resources & Legal Documentation`,
    `- [About Platform](${siteUrl}/about): Mission, philosophy, and architectural pillars of The Launch Feed.`,
    `- [Submit a Product ($0 Free)](${siteUrl}/submit): Launch software with 360° specs and instant AI extraction.`,
    `- [Top 100 Founders](${siteUrl}/founders): Verified leaderboard of top indie founders and software creators.`,
    `- [Contact & Support Desks](${siteUrl}/contact): Direct support, feature requests, and partnership desks.`,
    `- [Privacy Policy](${siteUrl}/privacy): Data protection, AES-256 telemetry encryption, and user rights.`,
    `- [Terms of Service](${siteUrl}/terms): Platform guidelines, voting integrity standards, and acceptable use.`,
    ``,
    `## Software Categories & Ecosystems`,
  ];

  for (const cat of categories) {
    lines.push(`- [${cat.name}](${siteUrl}/category/${cat.slug}): ${cat._count.products} live products`);
  }

  lines.push(``, `## Top Live Products & Architectural Intelligence`);

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

  lines.push(``, `## Featured Founders & Software Craftsmen`);

  for (const f of founders) {
    const displayName = f.name || f.username;
    const prods = f.products.map((pr) => pr.name).join(", ");
    const prodStr = prods ? ` · Creator of ${prods}` : "";
    const titleStr = f.title ? ` (${f.title})` : "";
    lines.push(
      `- [${displayName} (@${f.username})](${siteUrl}/founder/${f.username})${titleStr}${prodStr}`
    );
  }

  lines.push(``, `## Official Broadcast & Telemetry Channels`);
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
