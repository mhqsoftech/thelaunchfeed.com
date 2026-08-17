import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 60; // 1 minute cache

export async function GET() {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

  try {
    const products = await prisma.product.findMany({
      where: {
        status: "LIVE",
      },
      orderBy: [{ launchedAt: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: {
        category: {
          select: {
            name: true,
          },
        },
        owner: {
          select: {
            name: true,
            username: true,
            twitterHandle: true,
          },
        },
      },
    });

    const itemsXml = products
      .map((p) => {
        const itemUrl = `${siteUrl}/product/${p.slug}`;
        const title = `${p.name} — ${p.tagline}`;
        const description = p.description || p.tagline;
        const pubDate = (p.launchedAt || p.createdAt).toUTCString();
        const maker = p.owner?.name || p.owner?.username || "The Launch Feed Maker";
        const catName = p.category?.name || "Technology";

        return `
    <item>
      <title><![CDATA[${title}]]></title>
      <link>${itemUrl}</link>
      <guid isPermaLink="true">${itemUrl}</guid>
      <description><![CDATA[${description}]]></description>
      <author><![CDATA[${maker}]]></author>
      <category><![CDATA[${catName}]]></category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
      })
      .join("");

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Launch Feed — Daily Product Drops</title>
    <link>${siteUrl}</link>
    <description>The daily leaderboard and product intelligence platform for indie makers, SaaS builders, and engineering teams.</description>
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${itemsXml}
  </channel>
</rss>`;

    return new NextResponse(rssXml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[feed.xml] error:", error);
    return new NextResponse("Error generating RSS feed", { status: 500 });
  }
}
