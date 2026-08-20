import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Content negotiation for AI agents — auto-applies to every current AND
 * future public page.
 *
 * Requests are converted to Markdown when either:
 *   - `Accept: text/markdown` is ranked at or above `text/html`, or
 *   - the `?format=md` query parameter is set.
 *
 * The matcher below opts EVERY route in by default and excludes only the
 * paths that must never be markdown-converted: Next.js internals, static
 * assets, APIs (including the /api/md renderer itself — that would loop),
 * admin/moderator dashboards, auth flows, sitemaps, and machine-readable
 * files. Any new content route you add later is covered automatically.
 */

// Route prefixes that must always fall through untouched.
const EXCLUDE_PREFIXES = [
  "/api/",
  "/admin",
  "/handler",
  "/_next/",
  "/.well-known/",
  "/static/",
  "/fonts/",
];

// Exact paths that must always fall through untouched.
const EXCLUDE_EXACT = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/favicon.ico",
  "/manifest.json",
  "/manifest.webmanifest",
]);

// File extensions we never rewrite — belt for anything that slips past the
// matcher (image URLs served from app routes, downloads, etc.).
const ASSET_EXT = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|otf|pdf|zip|xml|txt|json|mp4|webm|mp3|wav)$/i;

function wantsMarkdown(req: NextRequest): boolean {
  if (req.nextUrl.searchParams.get("format") === "md") return true;

  const accept = req.headers.get("accept") || "";
  if (!accept.includes("text/markdown")) return false;

  // Only serve markdown when the caller ranks it at or above HTML. Browsers
  // send `text/html,application/xhtml+xml,...` and never include
  // `text/markdown`, so humans stay on the React app; agents that send
  // `Accept: text/markdown, text/html;q=0.9` get the markdown view.
  const htmlIdx = accept.indexOf("text/html");
  const mdIdx = accept.indexOf("text/markdown");
  return mdIdx !== -1 && (htmlIdx === -1 || mdIdx < htmlIdx);
}

function isEligiblePath(pathname: string): boolean {
  if (EXCLUDE_EXACT.has(pathname)) return false;
  if (EXCLUDE_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) {
    return false;
  }
  if (ASSET_EXT.test(pathname)) return false;
  return true;
}

export function middleware(req: NextRequest) {
  if (req.method !== "GET" && req.method !== "HEAD") return NextResponse.next();
  if (!wantsMarkdown(req)) return NextResponse.next();

  const pathname = req.nextUrl.pathname;
  if (!isEligiblePath(pathname)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/api/md${pathname.replace(/\/$/, "") || ""}`;
  const res = NextResponse.rewrite(url);
  // Vary on Accept so Cloudflare / Vercel edge caches keep the HTML and
  // Markdown representations in separate buckets — a browser must never
  // receive a cached markdown response, and vice versa.
  res.headers.set("Vary", "Accept");
  return res;
}

// Match every path except the ones we can prove should never be converted.
// Anything that survives this matcher is then filtered by isEligiblePath
// above, so the two layers combined guarantee no loop, no asset breakage,
// and no accidental markdown for admin or API responses.
export const config = {
  matcher: [
    "/((?!api|_next|admin|handler|\\.well-known|static|fonts|favicon.ico|robots.txt|sitemap.xml|manifest.json|manifest.webmanifest|llms.txt|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|otf|pdf|zip|xml|txt|json|mp4|webm|mp3|wav)).*)",
  ],
};
