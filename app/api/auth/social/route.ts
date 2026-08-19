import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") || "google";
  const returnTo = searchParams.get("after_auth_return_to") || searchParams.get("redirect") || "/profile";
  const safeReturn = returnTo.startsWith("/") ? returnTo : "/profile";

  // Accurately determine public origin even behind reverse proxies (Vercel, Cloudflare, etc.)
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host") || new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") || (req.url.startsWith("https") ? "https" : "http");
  const origin = `${proto}://${host}`;

  const neonAuthUrl =
    process.env.NEON_AUTH_URL ||
    process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
    "";

  if (neonAuthUrl) {
    try {
      const callbackURL = `${origin}/handler/sign-in?after_auth_return_to=${encodeURIComponent(safeReturn)}`;

      const res = await fetch(`${neonAuthUrl}/sign-in/social`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
        },
        body: JSON.stringify({
          provider,
          callbackURL,
        }),
      });

      const data = await res.json().catch(() => null);

      if (data && data.url) {
        const response = NextResponse.redirect(data.url);

        // Forward all Set-Cookie headers (challenges, CSRF tokens, etc.) from Neon Auth
        const setCookies =
          typeof res.headers.getSetCookie === "function"
            ? res.headers.getSetCookie()
            : res.headers.get("set-cookie")
              ? [res.headers.get("set-cookie")!]
              : [];

        for (const cookie of setCookies) {
          response.headers.append("set-cookie", cookie);
        }

        return response;
      }
      console.warn(`[neon-auth:social] Neon Auth error or missing redirect URL:`, data);
    } catch (e) {
      console.error(`[neon-auth:social] Server fetch failed:`, e);
    }
  }

  // Fallback: Redirect to sign-in page with error if neither provider succeeds
  return NextResponse.redirect(
    new URL(
      `/handler/sign-in?error=${encodeURIComponent(`${provider} sign-in could not be initiated.`)}&after_auth_return_to=${encodeURIComponent(safeReturn)}`,
      req.url
    )
  );
}
