import { NextRequest, NextResponse, after } from "next/server";
import { recordBadgeImpression, findLiveProductBySite } from "@/lib/free-launch";
import { prisma } from "@/lib/db";
import { renderBadge } from "@/lib/badge/render";
import { formatUsdMonthly } from "@/lib/revenue/format";
import { isAwardTimegateEligible } from "@/lib/queries/awards";


export const dynamic = "force-dynamic";
export const revalidate = 0;

// A badge loaded from a maker's site proves the embed (works for SPAs whose
// HTML we can't crawl). Throttled per domain so hot badges don't hammer the DB.
const lastImpression = new Map<string, number>();
function trackImpression(referer: string | null) {
  if (!referer) return;
  let host = "";
  try {
    host = new URL(referer).hostname;
  } catch {
    return;
  }
  const now = Date.now();
  if (now - (lastImpression.get(host) ?? 0) < 60 * 60_000) return;
  lastImpression.set(host, now);
  if (lastImpression.size > 5000) lastImpression.clear();
  after(() => recordBadgeImpression(referer));
}

/**
 * GET /api/badge/[slug]
 * Dynamic vector SVG badge generator for makers to embed on their site, GitHub README, or docs.
 * Rendering lives in lib/badge/render.ts (one layout for every award, 4 themes:
 * light, dark, signal, minimal). This route resolves the product + award.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const params = await context.params;
  let slug = params.slug;
  const searchParams = request.nextUrl.searchParams;

  // Pre-launch "featured" badge embedded with ?site=<maker site>: once that
  // product is live, render its real launch badge (votes etc.) instead —
  // makers never need to re-embed.
  const siteParam = searchParams.get("site");
  if (slug === "featured" && siteParam) {
    try {
      const live = await findLiveProductBySite(siteParam);
      if (live) slug = live.slug;
    } catch {}
  }
  trackImpression(request.headers.get("referer"));
  const theme = (searchParams.get("theme") || "dark").toLowerCase();
  const award = (searchParams.get("award") || "launch").toLowerCase();

  // Look up live product data for real upvotes, name, and revenue
  let product: {
    name: string;
    voteCount: number;
    category: { name: string } | null;
    launchedAt: Date;
    revenue: { isVerified: boolean; mrrCents: number } | null;
  } | null = null;
  try {
    product = await prisma.product.findUnique({
      where: { slug },
      select: {
        name: true,
        voteCount: true,
        launchedAt: true,
        category: { select: { name: true } },
        revenue: { select: { isVerified: true, mrrCents: true } },
      },
    });
  } catch {}

  const votes = product?.voteCount || 1;

  // Time-gate enforcement: if the requested award hasn't met its
  // minimum elapsed time since launch, fall back to the generic launch badge.
  let effectiveAward = award;
  if (product?.launchedAt && !isAwardTimegateEligible(award, product.launchedAt)) {
    effectiveAward = "launch";
  }

  // Only provider-verified revenue may appear on a "Verified revenue" badge —
  // never the self-reported text from the submission form.
  const revenue =
    product?.revenue?.isVerified && product.revenue.mrrCents > 0
      ? `${formatUsdMonthly(product.revenue.mrrCents).replace(" / mo", "")} MRR`
      : null;

  const { svg } = renderBadge({
    award: effectiveAward,
    theme,
    votes: product ? votes : null,
    revenue,
    year: product?.launchedAt ? new Date(product.launchedAt).getUTCFullYear() : undefined,
    featured: !product && slug === "featured",
  });

  const isDownload =
    searchParams.get("download") === "true" ||
    searchParams.get("download") === "1" ||
    searchParams.get("dl") === "1";
  const filename = `${slug || "launchfeed"}-${effectiveAward}-${theme}-badge.svg`;

  const responseHeaders: Record<string, string> = {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Access-Control-Allow-Origin": "*",
  };

  if (isDownload) {
    responseHeaders["Content-Disposition"] = `attachment; filename="${filename}"`;
  }

  return new NextResponse(svg, {
    headers: responseHeaders,
  });
}

