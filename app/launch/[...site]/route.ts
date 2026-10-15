import { after, NextRequest, NextResponse } from "next/server";
import { findLiveProductBySite } from "@/lib/free-launch";
import { clickContext, recordClick } from "@/lib/outbound/track";

/**
 * Smart badge link: /launch/<maker-site>  e.g. /launch/acme.com
 *
 * Makers embed this before their product exists here (the slug isn't known
 * until launch). Each click resolves it:
 *   - product is live  → /product/<slug>
 *   - not live yet     → homepage (never a 404)
 *
 * A click on a live product's badge is counted as a "badge" visit (traffic the
 * maker's badge sends us) for their dashboard — recorded after the redirect.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ site: string[] }> }) {
  const { site } = await context.params;
  const key = (site || []).map((s) => decodeURIComponent(s)).join("/");

  let target = "/";
  try {
    const product = key ? await findLiveProductBySite(key) : null;
    if (product) {
      target = `/product/${encodeURIComponent(product.slug)}`;
      const ctx = clickContext(req);
      if (ctx.track) {
        after(() => recordClick(product.id, "badge", ctx).catch((err) => console.error("[launch-link] record failed:", err)));
      }
    }
  } catch (err) {
    console.error("[launch-link] lookup failed:", err);
  }

  const url = new URL(target, req.nextUrl.origin);
  url.searchParams.set("ref", "badge");
  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      // The answer changes the moment the product launches — never cache.
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
