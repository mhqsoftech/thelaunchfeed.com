import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/auth";
import { syncNeonAuthSession } from "@/lib/neon-auth-sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get("after_auth_return_to") || searchParams.get("redirect") || "/profile";
  const safeReturn = returnTo.startsWith("/") ? returnTo : "/profile";

  try {
    // 1. Check if token or session is in query params or cookies
    const queryToken = searchParams.get("token") || searchParams.get("session_token");
    const cookieToken =
      queryToken ||
      req.cookies.get("tlf.session_token")?.value ||
      req.cookies.get("__Secure-tlf.session_token")?.value ||
      req.cookies.get("neon-auth.session_token")?.value ||
      req.cookies.get("__Secure-neon-auth.session_token")?.value ||
      req.cookies.get("better-auth.session_token")?.value ||
      req.cookies.get("__Secure-better-auth.session_token")?.value;

    let sessionUser = null;
    let sessionToken = cookieToken || "";

    if (cookieToken) {
      const decoded = decodeURIComponent(cookieToken);
      const cleanToken = decoded.replace(/^s:/, "");
      const dotSplit = cleanToken.split(".")[0];
      const rawSplit = cookieToken.split(".")[0];

      const found = await prisma.session.findFirst({
        where: {
          OR: [
            { token: cookieToken },
            { token: decoded },
            { token: cleanToken },
            { token: dotSplit },
            { token: rawSplit },
          ],
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      });

      if (found?.user) {
        sessionUser = found.user;
        sessionToken = found.token;
      }
    }

    // 2. If not found in public tables, sync from neon_auth schema —
    //    ONLY when the caller presented a token. Never look up "most recent
    //    session" without a token: that logs the visitor in as whoever last
    //    signed in on the platform (account takeover).
    if (!sessionUser && cookieToken) {
      const synced = await syncNeonAuthSession(cookieToken);
      if (synced) {
        sessionUser = synced.user;
        sessionToken = synced.token;
      }
    }

    if (sessionUser && sessionToken) {
      const user = sessionUser;
      const initials = (user.name || user.email)
        .split(/\s+/)
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();

      const userSession = {
        id: user.id,
        name: user.name || user.username,
        handle: user.username.startsWith("@") ? user.username : `@${user.username}`,
        email: user.email,
        role: isAdminEmail(user.email) ? "admin" : "founder",
        avatar: initials || "U",
        image: user.image,
        title: user.title || "",
        bio: user.bio || "",
        revenue: "",
        website: user.websiteUrl || "",
        twitter: user.twitterHandle || "",
        github: user.githubHandle || "",
        apiKey: "",
        savedProductIds: user.savedProductIds || [],
        upvotedProductIds: [],
        subscriptions: [],
      };

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating...</title>
</head>
<body style="background:#09090b;color:#fff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <div style="font-size:14px;letter-spacing:0.05em;margin-bottom:8px;">AUTHENTICATING...</div>
    <div style="font-size:11px;color:#71717a;">Redirecting you to The Launch Feed</div>
  </div>
  <script>
    try {
      localStorage.setItem("tlf-user-session", ${JSON.stringify(JSON.stringify(userSession))});
      window.dispatchEvent(new CustomEvent("authChanged", { detail: ${JSON.stringify(userSession)} }));
    } catch(e){}
    window.location.replace(${JSON.stringify(safeReturn)});
  </script>
</body>
</html>`;

      const response = new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });

      response.cookies.set("tlf.session_token", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      response.cookies.set("better-auth.session_token", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      if (process.env.NODE_ENV === "production") {
        response.cookies.set("__Secure-tlf.session_token", sessionToken, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
        response.cookies.set("__Secure-better-auth.session_token", sessionToken, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }

      return response;
    }
  } catch (e) {
    console.error("[neon-auth:callback] error:", e);
  }

  return NextResponse.redirect(new URL(safeReturn, req.url));
}
