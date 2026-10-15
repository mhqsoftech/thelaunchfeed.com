import { NextRequest, NextResponse } from "next/server";

/** Bare /launch (badge embedded without a site) → homepage, never a 404. */
export function GET(req: NextRequest) {
  const url = new URL("/", req.nextUrl.origin);
  url.searchParams.set("ref", "badge");
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
