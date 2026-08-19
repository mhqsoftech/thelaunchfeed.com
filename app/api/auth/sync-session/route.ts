import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { syncNeonAuthSession } from "@/lib/neon-auth-sync";

export const dynamic = "force-dynamic";

/**
 * Mirrors a Neon Auth session cookie into first-party cookies after
 * social-login redirect. Must ONLY re-mint a cookie for a session the caller
 * can prove they hold — never a session looked up by userId or by "most recent."
 * A bare userId is not a credential and must never be accepted as one.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken : "";
    if (!sessionToken) {
      return NextResponse.json({ error: "Missing session token" }, { status: 400 });
    }

    const rawToken = sessionToken.split(".")[0];

    // 1. Match against public."Session" by TOKEN only.
    let dbSession = await prisma.session.findFirst({
      where: {
        OR: [{ token: sessionToken }, { token: rawToken }],
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            image: true,
            role: true,
            bio: true,
            websiteUrl: true,
            twitterHandle: true,
            githubHandle: true,
            savedProductIds: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Fall back to neon_auth by the same token (creates public.User + Session).
    if (!dbSession) {
      const synced = await syncNeonAuthSession(sessionToken);
      if (synced) {
        dbSession = await prisma.session.findFirst({
          where: { token: synced.token, expiresAt: { gt: new Date() } },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                username: true,
                image: true,
                role: true,
                bio: true,
                websiteUrl: true,
                twitterHandle: true,
                githubHandle: true,
                savedProductIds: true,
                createdAt: true,
              },
            },
          },
        });
      }
    }

    if (!dbSession || !dbSession.user) {
      return NextResponse.json({ error: "Session record not found" }, { status: 404 });
    }

    const cookieStore = await cookies();
    const tokenToSet = dbSession.token;

    cookieStore.set("tlf.session_token", tokenToSet, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    cookieStore.set("better-auth.session_token", tokenToSet, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    if (process.env.NODE_ENV === "production") {
      cookieStore.set("__Secure-tlf.session_token", tokenToSet, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      cookieStore.set("__Secure-better-auth.session_token", tokenToSet, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    const user = dbSession.user;
    return NextResponse.json({
      ok: true,
      session: {
        id: user.id,
        name: user.name || user.username,
        handle: user.username.startsWith("@") ? user.username : `@${user.username}`,
        email: user.email,
        role: user.role,
        avatar: (user.name || user.email).slice(0, 2).toUpperCase(),
        image: user.image || "",
        savedProductIds: user.savedProductIds || [],
        upvotedProductIds: [],
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Session sync failed" }, { status: 500 });
  }
}
