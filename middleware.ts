import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Content negotiation for AI agents.
 *
 * When a request explicitly asks for `text/markdown` (either via the Accept
 * header or `?format=md`), we rewrite to an internal render route that
 * fetches the HTML, strips it down to the primary content, and returns
 * clean Markdown. Browsers — which send `text/html,*/*` — never trip the
 * check and continue to see the normal React app.
 *
 * Scope is deliberately narrow: only the public content pages agents
 * actually want to read (leaderboard, product, founder, category).
 * Static files, APIs, admin, and auth routes fall through unchanged.
 */

// Path patterns that opt-in to markdown negotiation.
const MD_PATH_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/product\/[^\/]+\/?$/,
  /^\/founder\/[^\/]+\/?$/,
  /^\/category\/[^\/]+\/?$/,
  /^\/founders\/?$/,
];

function wantsMarkdown(req: NextRequest): boolean {
  if (req.nextUrl.searchParams.get("format") === "md") return true;

  const accept = req.headers.get("accept") || "";
  if (!accept.includes("text/markdown")) return false;

  // Only serve markdown when the caller ranks it above HTML. Browsers send
  // `text/html,application/xhtml+xml,...` and never include `text/markdown`,
  // so this check keeps humans on the React app while honouring explicit
  // agent negotiation like `Accept: text/markdown, text/html;q=0.9`.
  const htmlIdx = accept.indexOf("text/html");
  const mdIdx = accept.indexOf("text/markdown");
  return mdIdx !== -1 && (htmlIdx === -1 || mdIdx < htmlIdx);
}

export function middleware(req: NextRequest) {
  if (!wantsMarkdown(req)) return NextResponse.next();

  const pathname = req.nextUrl.pathname;
  if (!MD_PATH_PATTERNS.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/api/md${pathname.replace(/\/$/, "") || ""}`;
  const res = NextResponse.rewrite(url);
  // Vary on Accept so Cloudflare / Vercel edge caches keep the HTML and
  // Markdown representations in separate buckets — a browser must never
  // receive a cached markdown response, and vice versa.
  res.headers.set("Vary", "Accept");
  return res;
}

export const config = {
  matcher: [
    "/",
    "/product/:slug*",
    "/founder/:slug*",
    "/category/:slug*",
    "/founders",
  ],
};
