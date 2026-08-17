import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function performSignOut(req: NextRequest) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("tlf.session_token")?.value ||
    cookieStore.get("__Secure-tlf.session_token")?.value ||
    cookieStore.get("better-auth.session_token")?.value ||
    cookieStore.get("__Secure-better-auth.session_token")?.value ||
    cookieStore.get("neon-auth.session_token")?.value ||
    cookieStore.get("__Secure-neon-auth.session_token")?.value;

  if (token) {
    const cleanToken = decodeURIComponent(token).replace(/^s:/, "").split(".")[0];
    try {
      await prisma.session.deleteMany({
        where: {
          OR: [
            { token },
            { token: cleanToken },
          ],
        },
      });
    } catch {}

    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM neon_auth.session WHERE token = $1 OR token = $2`,
        token,
        cleanToken
      );
    } catch {}
  }

  const cookieNames = [
    "tlf.session_token",
    "__Secure-tlf.session_token",
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "neon-auth.session_token",
    "__Secure-neon-auth.session_token",
  ];

  const isHtml = req.headers.get("accept")?.includes("text/html") && req.method === "GET";
  const response = isHtml
    ? NextResponse.redirect(new URL("/", req.url))
    : NextResponse.json({ success: true });

  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }

  return response;
}

export async function GET(req: NextRequest) {
  return performSignOut(req);
}

export async function POST(req: NextRequest) {
  return performSignOut(req);
}
