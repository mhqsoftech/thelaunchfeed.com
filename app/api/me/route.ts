import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/me
 * Returns the current signed-in user in the client-side UserSession shape
 * (see app/data.ts). The client SessionBridge fetches this once on mount
 * and hydrates localStorage so legacy getStoredSession() callers work
 * against the real Stack-authenticated user.
 *
 * 200 { session } when signed in, 200 { session: null } otherwise.
 */
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ session: null });

  const votes = await prisma.vote.findMany({
    where: { userId: u.id },
    select: { productId: true },
  });
  const upvotedProductIds = votes.map((v) => v.productId);
  const savedProductIds = u.savedProductIds ?? [];

  const initials = (u.name || u.email)
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return NextResponse.json({
    session: {
      id: u.id,
      name: u.name || u.username,
      handle: `@${u.username}`,
      email: u.email,
      role: isAdminEmail(u.email) ? "admin" : "founder",
      avatar: initials || "U",
      image: u.image,
      title: u.title || "",
      bio: u.bio || "",
      revenue: "",
      website: u.websiteUrl || "",
      twitter: u.twitterHandle || "",
      github: u.githubHandle || "",
      apiKey: "",
      savedProductIds,
      upvotedProductIds,
      subscriptions: [],
    },
  });
}
