import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow",
};

/**
 * Rescues Amazon SES / Resend click-tracking links from previously sent emails
 * if click tracking was enabled with a domain or subdomain pointing to our host
 * (e.g. https://noreply.thelaunchfeed.com/CL0/... or /CL0/https:%2F%2F...).
 *
 * Example incoming URL:
 *   /CL0/https:%2F%2Fthelaunchfeed.com%2Fsubmit/1/010601a16d34ffcc-7d32962e-.../sig
 *
 * Decodes the intended destination, validates it against allowed destinations
 * to prevent open redirects, and 302 redirects the user directly there.
 */
function extractDestination(rawUrl: string, pathname: string): string | null {
  try {
    const cl0Idx = rawUrl.indexOf("/CL0/");
    const pathCl0Idx = pathname.indexOf("/CL0/");
    const targetSource =
      cl0Idx !== -1
        ? rawUrl.slice(cl0Idx + 5)
        : pathCl0Idx !== -1
          ? pathname.slice(pathCl0Idx + 5)
          : null;

    if (!targetSource) return null;

    // The destination URL in SES CL0 URLs is the first path segment after /CL0/
    const parts = targetSource.split("/");
    const firstPart = parts[0];

    let decoded = firstPart;
    if (
      decoded.includes("%2F") ||
      decoded.includes("%2f") ||
      decoded.includes("%3A") ||
      decoded.includes("%3a") ||
      decoded.startsWith("https:%2F") ||
      decoded.startsWith("http:%2F")
    ) {
      try {
        decoded = decodeURIComponent(firstPart);
      } catch {}
      if (decoded.includes("%2F") || decoded.includes("%3A")) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch {}
      }
    }

    if (!decoded.startsWith("http://") && !decoded.startsWith("https://")) {
      // In case the path was decoded before reaching the handler
      const match = targetSource.match(/^(https?:\/\/[^\/]+(?:\/[^?#]*)?(?:\?[^#]*)?)/i);
      if (match) {
        decoded = match[1].replace(/\/\d+\/[0-9a-zA-Z_-]+-000000\/[^\/]+$/, "");
      }
    }

    if (!decoded.startsWith("http://") && !decoded.startsWith("https://")) {
      return null;
    }

    const parsed = new URL(decoded);
    const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
    const allowedHosts = new Set([
      "thelaunchfeed.com",
      "www.thelaunchfeed.com",
      "localhost",
      "127.0.0.1",
      new URL(appOrigin).host.toLowerCase(),
    ]);

    if (!allowedHosts.has(parsed.host.toLowerCase())) {
      const allowedExternal = ["chat.whatsapp.com", "t.me", "bsky.app"];
      if (!allowedExternal.some((h) => parsed.host.toLowerCase().endsWith(h))) {
        return "/";
      }
    }

    return parsed.toString();
  } catch (err) {
    console.error("[CL0] Failed to extract destination:", err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const dest = extractDestination(req.url, req.nextUrl.pathname);
  if (!dest) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin), {
      status: 302,
      headers: HEADERS,
    });
  }

  return NextResponse.redirect(dest, {
    status: 302,
    headers: HEADERS,
  });
}
