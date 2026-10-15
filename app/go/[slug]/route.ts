import { after, NextRequest, NextResponse } from "next/server";
import { isOutboundSource } from "@/lib/outbound/links";
import { clickContext, recordClick, resolveDestination } from "@/lib/outbound/track";

/**
 * Tracked outbound link: /go/<product-slug>?src=<placement>[&slot=<slotId>]
 *
 * 302s to the maker's website (with ?ref=thelaunchfeed) and records the visit
 * after the response is sent. The redirect never waits on the click write and
 * never fails: an unknown slug or a DB outage falls back to our product page.
 */
export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await context.params;
  const slug = decodeURIComponent(rawSlug || "").slice(0, 200);
  const params = req.nextUrl.searchParams;
  const srcParam = params.get("src");
  const source = isOutboundSource(srcParam) && srcParam !== "badge" ? srcParam : "product_page";
  const slot = params.get("slot")?.slice(0, 64) || null;

  let dest = null;
  try {
    dest = slug ? await resolveDestination(slug, slot) : null;
  } catch (err) {
    console.error("[go] lookup failed:", err);
  }

  if (!dest) {
    const fallback = new URL(slug ? `/product/${encodeURIComponent(slug)}` : "/", req.nextUrl.origin);
    return NextResponse.redirect(fallback, { status: 302, headers: HEADERS });
  }

  const ctx = clickContext(req);
  if (ctx.track) {
    const { productId } = dest;
    after(() => recordClick(productId, source, ctx).catch((err) => console.error("[go] record failed:", err)));
  }
  return NextResponse.redirect(dest.url, { status: 302, headers: HEADERS });
}
