import { cache } from "react";
import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/better-auth";
import { syncNeonAuthSession } from "@/lib/neon-auth-sync";
import type { User } from "@prisma/client";

/**
 * Session helpers used by server components, server actions, and route
 * handlers. Better Auth is the source of truth — auth.api.getSession
 * reads the cookie and returns a { user, session } pair (or null).
 */

const userSessionCache = new Map<string, { user: User; timestamp: number }>();
const USER_SESSION_TTL_MS = 30_000; // 30s

export function invalidateUserSessionCache(userId?: string) {
  if (!userId) {
    userSessionCache.clear();
    return;
  }
  for (const [key, val] of userSessionCache.entries()) {
    if (val.user.id === userId) {
      userSessionCache.delete(key);
    }
  }
}

export const getCurrentUser = cache(async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    let token =
      cookieStore.get("tlf.session_token")?.value ||
      cookieStore.get("__Secure-tlf.session_token")?.value ||
      cookieStore.get("better-auth.session_token")?.value ||
      cookieStore.get("__Secure-better-auth.session_token")?.value ||
      cookieStore.get("neon-auth.session_token")?.value ||
      cookieStore.get("__Secure-neon-auth.session_token")?.value ||
      cookieStore.get("authjs.session-token")?.value ||
      cookieStore.get("__Secure-authjs.session-token")?.value ||
      cookieStore.get("session_token")?.value ||
      cookieStore.get("auth_session")?.value;

    if (!token) {
      const match = allCookies.find((c) =>
        c.name.toLowerCase().includes("session") ||
        c.name.toLowerCase().includes("token")
      );
      if (match) token = match.value;
    }

    // Fast-path: if no auth session cookie exists, the visitor is unauthenticated.
    if (!token) return null;

    const cached = userSessionCache.get(token);
    if (cached && Date.now() - cached.timestamp < USER_SESSION_TTL_MS) {
      return cached.user;
    }

    const h = await headers();
    const result = await auth.api.getSession({ headers: h }).catch(() => null);
    if (result?.user?.id) {
      const u = await prisma.user.findUnique({ where: { id: result.user.id } });
      if (u) {
        userSessionCache.set(token, { user: u, timestamp: Date.now() });
        return u;
      }
    }

    // Fallback: check session tokens directly from cookies (support both token and id)
    const decoded = decodeURIComponent(token);
    const cleanToken = decoded.replace(/^s:/, "");
    const dotSplit = cleanToken.split(".")[0];
    const rawSplit = token.split(".")[0];

    const session = await prisma.session.findFirst({
      where: {
        OR: [
          { token },
          { token: decoded },
          { token: cleanToken },
          { token: dotSplit },
          { token: rawSplit },
          { id: token },
          { id: decoded },
          { id: cleanToken },
          { id: dotSplit },
          { id: rawSplit },
        ],
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    if (session?.user) {
      userSessionCache.set(token, { user: session.user, timestamp: Date.now() });
      return session.user;
    }

    // Check if session exists in neon_auth schema and auto-sync
    const synced = await syncNeonAuthSession(token);
    if (synced?.user) {
      userSessionCache.set(token, { user: synced.user, timestamp: Date.now() });
      return synced.user;
    }
  } catch (err) {
    console.warn("[auth:getCurrentUser] error resolving session:", err);
  }

  return null;
});

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "ADMIN" && !isAdminEmail(u.email)) throw new Error("FORBIDDEN");
  return u;
}

export function isAdminEmail(email: string): boolean {
  const admin = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!admin) return false;
  return email.trim().toLowerCase() === admin;
}

/** True when auth environment is configured. Used only for UX gates. */
export const isAuthConfigured = true;
