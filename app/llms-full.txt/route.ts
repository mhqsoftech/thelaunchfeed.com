import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDelistedSections, GENUINE_PRODUCT_FILTER } from "@/lib/queries/products";

export const dynamic = "force-dynamic";
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET() {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

  const delistedSections = await getDelistedSections();
  const isFeedDelisted = delistedSections.includes("all");

  const products = await prisma.product.findMany({
    where: {
      status: "LIVE",
      ...(isFeedDelisted ? GENUINE_PRODUCT_FILTER : {}),
    },
        include: {
          category: { select: { name: true, slug: true } },
          owner: {
            select: {
              name: true,
              username: true,
              title: true,
              bio: true,
              websiteUrl: true,
              twitterHandle: true,
              githubHandle: true,
            },
          },
          revenue: {
            select: {
              isVerified: true,
              mrrCents: true,
              totalRevenueCents: true,
              connection: { select: { provider: true } },
            },
          },
        },
        orderBy: [{ voteCount: "desc" }, { launchedAt: "desc" }],
        take: 300,
      });

  const lines: string[] = [
    `# The Launch Feed — Complete 360° Technical & Product Knowledge Base`,
    `> Comprehensive architectural specifications, founder stories, and full technical specifications for all launched products on The Launch Feed.`,
    `> Dynamic source: ${siteUrl}/llms-full.txt`,
    `> Index summary: ${siteUrl}/llms.txt`,
    `> Dynamic XML Sitemap: ${siteUrl}/sitemap.xml`,
    ``,
    `## Platform Metadata & Core Pages`,
    `- [Home Daily Leaderboard](${siteUrl}/)`,
    `- [Top 100 Founders](${siteUrl}/founders)`,
    `- [Submit a Product ($0 Free)](${siteUrl}/submit)`,
    `- [About Platform](${siteUrl}/about)`,
    `- [Contact & Direct Support](${siteUrl}/contact)`,
    `- [Privacy Policy](${siteUrl}/privacy)`,
    `- [Terms of Service](${siteUrl}/terms)`,
    ``,
  ];

  if (products.length === 0) {
    lines.push(`No products currently published or active in the feed.`);
  }

  for (const p of products) {
    const d = (p.details as any) || {};
    const makerName = p.owner.name || p.owner.username;
    const url = `${siteUrl}/product/${p.slug}`;

    lines.push(`---`);
    lines.push(`## ${p.name}`);
    lines.push(`**Tagline:** ${p.tagline}`);
    lines.push(`**Category:** ${p.category?.name || "General"}`);
    lines.push(`**Official Website:** ${p.websiteUrl}`);
    lines.push(`**The Launch Feed Listing:** ${url}`);
    lines.push(`**Founder / Maker:** ${makerName} (@${p.owner.username})`);
    if (p.owner.title) lines.push(`**Founder Title:** ${p.owner.title}`);
    if (p.owner.bio) lines.push(`**Founder Bio:** ${p.owner.bio}`);
    lines.push(`**Community Upvotes:** ${p.voteCount}`);
    lines.push(`**Launched Date:** ${new Date(p.launchedAt).toISOString().slice(0, 10)}`);
    if (p.videoUrl) lines.push(`**Product Demo Video:** ${p.videoUrl}`);

    // Verified Revenue
    if (p.revenue?.isVerified) {
      const mrr = (p.revenue.mrrCents / 100).toLocaleString();
      const total = (p.revenue.totalRevenueCents / 100).toLocaleString();
      const provider = p.revenue.connection?.provider || "STRIPE";
      lines.push(`**Verified MRR:** $${mrr} / mo (${provider} Verified)`);
      if (p.revenue.totalRevenueCents > 0) {
        lines.push(`**Verified Cumulative Revenue:** $${total}`);
      }
    }

    // Executive Pitch
    const pitch = d.overviewPitch || p.description;
    if (pitch) {
      lines.push(``, `### Executive Pitch Summary`, pitch);
    }

    // Features
    const features: string[] = Array.isArray(d.features) && d.features.length > 0
      ? d.features
      : [d.feature1, d.feature2, d.feature3].filter(Boolean);
    if (features.length > 0) {
      lines.push(``, `### Core Features & Value Propositions`);
      for (const feat of features) {
        lines.push(`- ${feat}`);
      }
    }

    // Target Audience
    if (d.targetAudience) {
      lines.push(``, `### Target Audience & Ideal Customer Profile`, d.targetAudience);
    }

    // Architecture & Tech Stack
    lines.push(``, `### Technical Architecture & Infrastructure Specs`);
    if (d.techStack) lines.push(`- **Primary Tech Stack:** ${d.techStack}`);
    if (d.infraHosting) lines.push(`- **Infrastructure & Hosting:** ${d.infraHosting}`);
    if (d.apiUrl) lines.push(`- **Open API Endpoint:** ${d.apiUrl}`);
    if (d.githubUrl) lines.push(`- **Source Code Repository:** ${d.githubUrl}`);
    if (d.securityStandards) lines.push(`- **Security & Compliance:** ${d.securityStandards}`);

    // Pricing Tiers
    const pricing: Array<{ name: string; price: string; specs: string }> =
      Array.isArray(d.pricingTiers) && d.pricingTiers.length > 0
        ? d.pricingTiers
        : [
            d.freePlan ? { name: "Free", price: "$0/mo", specs: d.freePlan } : null,
            d.proPlan ? { name: "Pro", price: "$29/mo", specs: d.proPlan } : null,
            d.enterprisePlan ? { name: "Enterprise", price: "$199/mo", specs: d.enterprisePlan } : null,
          ].filter(Boolean) as any;

    if (pricing.length > 0) {
      lines.push(``, `### Pricing Tiers`);
      for (const t of pricing) {
        lines.push(`- **${t.name}** (${t.price}): ${t.specs}`);
      }
    }

    // Founder Story & Thesis
    if (d.originStory || d.makerThesis) {
      lines.push(``, `### Founder Story & Manifesto`);
      if (d.originStory) lines.push(`**Origin Story:** ${d.originStory}`);
      if (d.makerThesis) lines.push(`**Maker Thesis:** "${d.makerThesis}"`);
    }

    // Changelog & Roadmap
    if (d.latestVersion || d.latestChangelog || d.roadmapQ3 || d.roadmapQ4) {
      lines.push(``, `### Changelog & Future Roadmap`);
      if (d.latestVersion) lines.push(`- **Latest Version:** ${d.latestVersion}`);
      if (d.latestChangelog) lines.push(`- **Changelog Notes:** ${d.latestChangelog}`);
      if (d.roadmapQ3) lines.push(`- **Milestone 01:** ${d.roadmapQ3}`);
      if (d.roadmapQ4) lines.push(`- **Milestone 02:** ${d.roadmapQ4}`);
    }

    // FAQs
    const faqs: Array<{ q: string; a: string }> = Array.isArray(d.faqs) && d.faqs.length > 0
      ? d.faqs
      : [
          d.faq1Q && d.faq1A ? { q: d.faq1Q, a: d.faq1A } : null,
          d.faq2Q && d.faq2A ? { q: d.faq2Q, a: d.faq2A } : null,
        ].filter(Boolean) as any;

    if (faqs.length > 0) {
      lines.push(``, `### Frequently Asked Questions`);
      for (const faq of faqs) {
        lines.push(`- **Q: ${faq.q}**\n  A: ${faq.a}`);
      }
    }

    lines.push(``);
  }

  const markdownContent = lines.join("\n");

  return new NextResponse(markdownContent, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
