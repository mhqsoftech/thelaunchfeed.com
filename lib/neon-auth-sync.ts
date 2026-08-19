import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

export interface NeonAuthSessionRow {
  token: string;
  userId: string;
  expiresAt: Date | string;
  neonUserId: string;
  email: string;
  name: string | null;
  image: string | null;
}

export async function syncNeonAuthSession(token: string): Promise<{ user: User; token: string } | null> {
  if (!token) return null;
  try {
    const clean = decodeURIComponent(token).replace(/^s:/, "").split(".")[0];
    const rows = await prisma.$queryRaw<NeonAuthSessionRow[]>`
      SELECT s.token, s."userId", s."expiresAt", u.id as "neonUserId", u.email, u.name, u.image
      FROM neon_auth.session s
      JOIN neon_auth.user u ON s."userId" = u.id
      WHERE (s.token = ${token} OR s.token = ${clean}) AND s."expiresAt" > NOW()
      ORDER BY s."createdAt" DESC
      LIMIT 1
    `;

    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    if (!row.email) return null;

    // Check if user already exists in public."User" by email or id
    let appUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: row.email, mode: "insensitive" } },
          { id: row.neonUserId },
        ],
      },
    });

    if (!appUser) {
      let baseUsername = (row.name || row.email.split("@")[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (!baseUsername) baseUsername = "user";
      let username = baseUsername;
      let counter = 1;
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}${counter++}`;
      }

      appUser = await prisma.user.create({
        data: {
          id: row.neonUserId,
          email: row.email,
          name: row.name || "",
          username,
          image: row.image || null,
          emailVerified: true,
        },
      });
    } else {
      // Update avatar/name if missing
      if ((!appUser.image && row.image) || (!appUser.name && row.name)) {
        appUser = await prisma.user.update({
          where: { id: appUser.id },
          data: {
            ...(row.image && !appUser.image ? { image: row.image } : {}),
            ...(row.name && !appUser.name ? { name: row.name } : {}),
          },
        });
      }
    }

    // Upsert session in public."Session"
    const expDate = new Date(row.expiresAt);
    await prisma.session.upsert({
      where: { token: row.token },
      create: {
        id: row.token,
        token: row.token,
        userId: appUser.id,
        expiresAt: expDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        userId: appUser.id,
        expiresAt: expDate,
      },
    });

    return { user: appUser, token: row.token };
  } catch (err) {
    console.error("[neon-auth-sync] error:", err);
    return null;
  }
}
