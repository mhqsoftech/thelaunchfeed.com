import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const provider = searchParams.get("provider") || "google";
  const returnTo = searchParams.get("after_auth_return_to") || searchParams.get("redirect") || "/profile";
  const safeReturn = returnTo.startsWith("/") ? returnTo : "/profile";

  const neonAuthUrl =
    process.env.NEON_AUTH_URL ||
    process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
    "";

  if (neonAuthUrl) {
    try {
      const callbackURL = `${origin}/api/auth/callback/neon?after_auth_return_to=${encodeURIComponent(safeReturn)}`;

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

      const data = await res.json();
      if (data.url) {
        const response = NextResponse.redirect(data.url);
        
        // Forward any set-cookie headers from Neon Auth
        const setCookie = res.headers.get("set-cookie");
        if (setCookie) {
          response.headers.set("set-cookie", setCookie);
        }

        return response;
      }
      console.warn(`[neon-auth:social] Neon Auth did not return a redirect URL:`, data);
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
