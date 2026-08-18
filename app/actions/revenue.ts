"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, getCurrentUser, requireAdmin } from "@/lib/auth";
import { encryptPaymentApiKey, decryptPaymentApiKey } from "@/lib/crypto";
import { fetchLiveRevenueFromSDK } from "@/app/lib/revenueTelemetrySDK";
import type { RevenueProvider } from "@prisma/client";

const VALID_PROVIDERS: Record<string, RevenueProvider> = {
  stripe: "STRIPE",
  razorpay: "RAZORPAY",
  dodopayments: "DODOPAYMENTS",
  paddle: "PADDLE",
  lemonsqueezy: "LEMONSQUEEZY",
  chargebee: "CHARGEBEE",
  polar: "POLAR",
  revenuecat: "REVENUECAT",
  gumroad: "GUMROAD",
  fastspring: "FASTSPRING",
  paystack: "PAYSTACK",
  square: "SQUARE",
  creem: "CREEM",
};

function normalizeProvider(rawProvider: string): RevenueProvider {
  const clean = rawProvider.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (VALID_PROVIDERS[clean]) return VALID_PROVIDERS[clean];
  for (const [key, val] of Object.entries(VALID_PROVIDERS)) {
    if (clean.includes(key) || key.includes(clean)) return val;
  }
  return "STRIPE";
}

const SaveKeySchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1, "API key is required"),
  externalAccountId: z.string().optional(),
  productId: z.string().optional(),
});

export type SaveKeyInput = z.infer<typeof SaveKeySchema>;

export async function savePaymentApiKey(input: SaveKeyInput) {
  const user = await requireUser();
  const parsed = SaveKeySchema.parse(input);

  const providerEnum = normalizeProvider(parsed.provider);
  const rawKey = parsed.apiKey.trim();
  const externalAccountId = (parsed.externalAccountId || "").trim();

  // Encrypt the payment API key before storing in the database
  const encryptedAccessToken = encryptPaymentApiKey(rawKey);

  // Upsert the RevenueConnection row with the encrypted access token
  const connection = await prisma.revenueConnection.upsert({
    where: {
      userId_provider_externalAccountId: {
        userId: user.id,
        provider: providerEnum,
        externalAccountId,
      },
    },
    create: {
      userId: user.id,
      provider: providerEnum,
      externalAccountId,
      accessToken: encryptedAccessToken,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
    },
    update: {
      accessToken: encryptedAccessToken,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
      lastSyncError: null,
    },
  });

  // Run live SDK telemetry calculation to verify and fetch MRR metrics
  const telemetryResult = await fetchLiveRevenueFromSDK(parsed.provider, rawKey);
  const mrrCents = telemetryResult.mrrCents;
  const totalRevenueCents = telemetryResult.totalRevenueCents;

  // Persist the per-connection aggregate so multiple providers coexist without
  // clobbering each other via the ProductRevenue (productId-unique) rows.
  await prisma.revenueConnection.update({
    where: { id: connection.id },
    data: {
      mrrCents,
      arrCents: mrrCents * 12,
      totalRevenueCents,
      currency: "usd",
    },
  });

  // If a productId is provided, link or update ProductRevenue
  if (parsed.productId) {
    await prisma.productRevenue.upsert({
      where: { productId: parsed.productId },
      create: {
        productId: parsed.productId,
        connectionId: connection.id,
        mrrCents,
        arrCents: mrrCents * 12,
        totalRevenueCents,
        currency: "usd",
        isVerified: true,
        verifiedAt: new Date(),
        syncedAt: new Date(),
      },
      update: {
        connectionId: connection.id,
        mrrCents,
        arrCents: mrrCents * 12,
        totalRevenueCents,
        isVerified: true,
        verifiedAt: new Date(),
        syncedAt: new Date(),
      },
    });
  } else {
    // Settings-tab flow: for products that don't yet have a ProductRevenue row,
    // seed one against this connection so the product page shows verified MRR.
    // Do NOT overwrite an existing ProductRevenue tied to a different connection —
    // otherwise adding a second provider would silently reassign the first
    // provider's product revenue rows.
    const userProducts = await prisma.product.findMany({
      where: { ownerId: user.id, revenue: null },
      select: { id: true },
    });
    for (const p of userProducts) {
      await prisma.productRevenue.create({
        data: {
          productId: p.id,
          connectionId: connection.id,
          mrrCents,
          arrCents: mrrCents * 12,
          totalRevenueCents,
          currency: "usd",
          isVerified: true,
          verifiedAt: new Date(),
          syncedAt: new Date(),
        },
      });
    }
  }

  if (user.username) {
    revalidatePath(`/founder/${user.username}`);
  }
  revalidatePath("/profile");
  revalidatePath("/");

  return {
    success: true,
    connectionId: connection.id,
    provider: providerEnum,
    rawProvider: parsed.provider,
    // Return decrypted API key data so UI can display key's decrypted details
    apiKey: rawKey,
    isEncryptedAtRest: true,
    mrrFormatted: telemetryResult.mrrFormatted,
    telemetryLog: telemetryResult.sdkHandshakeLog,
    subscribersCount: telemetryResult.subscribersCount,
    momGrowth: telemetryResult.momGrowth,
    lastSyncedAt: connection.lastSyncedAt?.toISOString(),
  };
}

export async function getPaymentApiKeys() {
  const user = await getCurrentUser();
  if (!user) return [];

  const connections = await prisma.revenueConnection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      revenues: {
        include: {
          product: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
  });

  return connections.map((conn) => {
    // Decrypt the stored access token to retrieve the original API key
    const decryptedKey = decryptPaymentApiKey(conn.accessToken);
    const mrrCents = conn.mrrCents || conn.revenues.reduce((s, r) => s + (r.mrrCents || 0), 0);

    const fmt = (cents: number) =>
      cents >= 100000
        ? `$${(cents / 100000).toFixed(1)}K / mo`
        : `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)} / mo`;

    return {
      id: conn.id,
      provider: conn.provider,
      externalAccountId: conn.externalAccountId,
      status: conn.status,
      lastSyncedAt: conn.lastSyncedAt?.toISOString(),
      createdAt: conn.createdAt.toISOString(),
      apiKey: decryptedKey,
      apiKeyMasked: decryptedKey.length > 8
        ? `${decryptedKey.slice(0, 6)}...${decryptedKey.slice(-4)}`
        : decryptedKey,
      mrrCents,
      totalRevenueCents: conn.totalRevenueCents,
      mrrFormatted: mrrCents > 0 ? fmt(mrrCents) : "",
      revenues: conn.revenues.map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.product?.name,
        mrrCents: r.mrrCents,
        mrrFormatted: fmt(r.mrrCents),
        isVerified: r.isVerified,
      })),
    };
  });
}

export async function deletePaymentApiKey(connectionId: string) {
  const user = await requireUser();
  const conn = await prisma.revenueConnection.findFirst({
    where: { id: connectionId, userId: user.id },
  });
  if (!conn) return { success: false, error: "Connection not found" };
  await prisma.revenueConnection.delete({ where: { id: conn.id } });
  if (user.username) revalidatePath(`/founder/${user.username}`);
  revalidatePath("/profile");
  return { success: true };
}

export async function getPaymentApiKey(provider: string) {
  const user = await requireUser();
  const providerEnum = normalizeProvider(provider);

  const conn = await prisma.revenueConnection.findFirst({
    where: { userId: user.id, provider: providerEnum },
    orderBy: { createdAt: "desc" },
  });

  if (!conn) return null;

  const decryptedKey = decryptPaymentApiKey(conn.accessToken);

  return {
    id: conn.id,
    provider: conn.provider,
    externalAccountId: conn.externalAccountId,
    status: conn.status,
    lastSyncedAt: conn.lastSyncedAt?.toISOString(),
    apiKey: decryptedKey,
    apiKeyMasked: decryptedKey.length > 8
      ? `${decryptedKey.slice(0, 6)}...${decryptedKey.slice(-4)}`
      : decryptedKey,
  };
}

/* ─────────────────────────── Admin Revenue Data ─────────────────────────── */

export type AdminRevenueData = {
  purchases: {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    amountCents: number;
    currency: string;
    status: string;
    paymentId: string | null;
    createdAt: string;
    slots: {
      id: string;
      position: string;
      productName: string | null;
      startsAt: string;
      endsAt: string | null;
      isActive: boolean;
    }[];
  }[];
  activeSlots: {
    id: string;
    position: string;
    kind: string;
    productName: string | null;
    productSlug: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
    tierName: string;
    priceFormatted: string;
    startsAt: string;
    endsAt: string | null;
    daysRemaining: number;
    purchaseStatus: string | null;
  }[];
  revenueConnections: {
    id: string;
    provider: string;
    status: string;
    userName: string;
    userEmail: string;
    productName: string | null;
    productSlug: string | null;
    mrrCents: number;
    arrCents: number;
    totalRevenueCents: number;
    isVerified: boolean;
    syncedAt: string | null;
  }[];
  stats: {
    totalPlatformRevenueCents: number;
    activeSubscriptions: number;
    pendingPayments: number;
    verifiedConnections: number;
    totalVerifiedMrrCents: number;
    totalProviders: number;
  };
};

export async function getAdminRevenueData(): Promise<AdminRevenueData> {
  await requireAdmin();

  const now = new Date();

  // 1. Fetch all purchases with associated slots
  const purchases = await prisma.featuredPurchase.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, username: true, email: true } },
      slots: {
        include: {
          product: { select: { name: true, slug: true } },
        },
      },
    },
  });

  // 2. Fetch all currently active slots
  const activeSlots = await prisma.featuredSlot.findMany({
    where: {
      OR: [
        { endsAt: { gt: now } },
        { endsAt: null },
      ],
    },
    orderBy: [{ position: "asc" }, { order: "asc" }],
    include: {
      product: {
        include: {
          owner: { select: { name: true, username: true, email: true } },
        },
      },
      purchase: { select: { status: true, amountCents: true } },
    },
  });

  // 3. Fetch all verified revenue connections
  const productRevenues = await prisma.productRevenue.findMany({
    orderBy: { mrrCents: "desc" },
    include: {
      product: {
        select: { name: true, slug: true },
      },
      connection: {
        include: {
          user: { select: { name: true, username: true, email: true } },
        },
      },
    },
  });

  // 4. Compute stats
  const paidPurchases = purchases.filter((p) => p.status === "PAID");
  const totalPlatformRevenueCents = paidPurchases.reduce((sum, p) => sum + p.amountCents, 0);
  const pendingPayments = purchases.filter((p) => p.status === "PENDING").length;
  const verifiedRevenues = productRevenues.filter((r) => r.isVerified);
  const totalVerifiedMrrCents = verifiedRevenues.reduce((sum, r) => sum + r.mrrCents, 0);
  const distinctProviders = new Set(productRevenues.map((r) => r.connection.provider));

  return {
    purchases: purchases.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.name || p.user.username,
      userEmail: p.user.email,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      paymentId: p.stripePaymentIntentId,
      createdAt: p.createdAt.toISOString(),
      slots: p.slots.map((s) => ({
        id: s.id,
        position: s.position,
        productName: s.product?.name ?? s.customName ?? null,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt?.toISOString() ?? null,
        isActive: s.endsAt ? s.endsAt > now : true,
      })),
    })),
    activeSlots: activeSlots.map((s) => {
      const prod = s.product as any;
      const tierKey = s.position === "FEATURED" ? 5 : 10;
      const msRemaining = s.endsAt ? Math.max(0, s.endsAt.getTime() - now.getTime()) : Infinity;
      const daysRemaining = msRemaining === Infinity ? 999 : Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      return {
        id: s.id,
        position: s.position,
        kind: s.kind,
        productName: prod?.name ?? s.customName ?? null,
        productSlug: prod?.slug ?? null,
        ownerName: prod?.owner?.name ?? prod?.owner?.username ?? null,
        ownerEmail: prod?.owner?.email ?? null,
        tierName: tierKey === 5 ? "Featured Launch" : "Premium Spotlight",
        priceFormatted: tierKey === 5 ? "$5" : "$10",
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt?.toISOString() ?? null,
        daysRemaining,
        purchaseStatus: (s.purchase as any)?.status ?? null,
      };
    }),
    revenueConnections: productRevenues.map((r) => ({
      id: r.id,
      provider: r.connection.provider,
      status: r.connection.status,
      userName: r.connection.user.name || r.connection.user.username,
      userEmail: r.connection.user.email,
      productName: r.product?.name ?? null,
      productSlug: r.product?.slug ?? null,
      mrrCents: r.mrrCents,
      arrCents: r.arrCents,
      totalRevenueCents: r.totalRevenueCents,
      isVerified: r.isVerified,
      syncedAt: r.syncedAt?.toISOString() ?? null,
    })),
    stats: {
      totalPlatformRevenueCents,
      activeSubscriptions: activeSlots.length,
      pendingPayments,
      verifiedConnections: verifiedRevenues.length,
      totalVerifiedMrrCents,
      totalProviders: distinctProviders.size,
    },
  };
}
