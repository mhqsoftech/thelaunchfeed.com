import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { previewCustomProduct } from "@/lib/rail-spotlight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * POST /api/spotlight/preview  { url }
 * Reads a site's name, tagline and icon so a signed-in buyer can sponsor a
 * product that isn't listed on The Launch Feed. Signed-in only, so the
 * fetcher can't be used anonymously.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED", message: "Sign in first" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 500) : "";
  if (!url) return NextResponse.json({ error: "MISSING_URL", message: "Enter your product's URL" }, { status: 400 });

  try {
    const result = await previewCustomProduct(url);
    if (!result) {
      return NextResponse.json({ error: "INVALID_URL", message: "We couldn't reach that address. Check the URL and try again." }, { status: 400 });
    }
    // fetched: false → the site couldn't be read; the form asks for the details.
    return NextResponse.json({ success: true, product: result.product, fetched: result.fetched });
  } catch (err) {
    console.warn("[api/spotlight/preview] failed:", err);
    return NextResponse.json(
      { error: "FETCH_FAILED", message: "We couldn't read that site. You can fill in the name and tagline yourself." },
      { status: 422 }
    );
  }
}
