import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { sessionToken, userId } = await req.json();
    if (!sessionToken && !userId) {
      return NextResponse.json({ error: "Missing session identifier" }, { status: 400 });
    }

    const rawToken = sessionToken ? String(sessionToken).split(".")[0] : undefined;

    // Find the session row in PostgreSQL
    const dbSession = await prisma.session.findFirst({
      where: sessionToken
        ? { OR: [{ token: sessionToken }, { token: rawToken! }] }
        : { userId },
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

    if (!dbSession || !dbSession.user) {
      return NextResponse.json({ error: "Session record not found" }, { status: 404 });
    }

    const cookieStore = await cookies();
    const tokenToSet = dbSession.token;

    // Set first-party local cookies for Better Auth
    cookieStore.set("tlf.session_token", tokenToSet, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
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
    const userSession = {
      id: user.id,
      name: user.name || user.username,
      handle: user.username.startsWith("@") ? user.username : `@${user.username}`,
      email: user.email,
      role: user.role,
      avatar: (user.name || user.email).slice(0, 2).toUpperCase(),
      image: user.image || "",
      savedProductIds: user.savedProductIds || [],
      upvotedProductIds: [],
    };

    return NextResponse.json({ ok: true, session: userSession });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Session sync failed" }, { status: 500 });
  }
}
