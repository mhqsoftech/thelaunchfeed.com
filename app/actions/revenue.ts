"use server";

/**
 * Founder-facing revenue actions.
 *
 * Trust guarantees:
 *  - A key is stored ONLY after the provider confirms live data (lib/revenue).
 *  - Keys are encrypted at rest (AES-256-GCM, bound to owner + provider) and
 *    are never sent back to the browser — the UI only ever sees `keyHint`.
 *  - Revenue can only be attached to products the caller owns.
 *  - A background job re-verifies every connection; revoked keys un-verify
 *    their products automatically.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, getCurrentUser, requireAdmin } from "@/lib/auth";
import { CredentialError, ProviderUnavailableError, formatUsdMonthly, parseProviderId } from "@/lib/revenue";
import { connectProvider, linkProductToConnection, providerIdFromEnum } from "@/lib/revenue/store";
import { ensureRevenueColumns } from "@/lib/jobs/schema";

const SaveKeySchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(8, "Paste the full API key").max(4096),
  externalAccountId: z.string().max(200).optional(),
  productId: z.string().max(100).optional(),
});

export type SaveKeyInput = z.infer<typeof SaveKeySchema>;

// Per-user throttle: the verifier must not become a free key-checking oracle.
const lastAttempt = new Map<string, number>();

/** A failure whose message is safe (and useful) to show the founder. */
class FounderFacingError extends Error {}

/**
 * Connect a revenue provider key. Failures are *returned*, not thrown:
 * production builds replace a thrown server-action message with React's
 * generic "Minified React error #441", so the founder would never see why.
 */
export async function savePaymentApiKey(input: SaveKeyInput) {
  try {
    return await connectRevenueKey(input);
  } catch (err) {
    if (err instanceof FounderFacingError) return { success: false as const, error: err.message };
    if (err instanceof z.ZodError) return { success: false as const, error: err.issues[0]?.message || "Invalid API key." };
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return { success: false as const, error: "Sign in to verify your revenue." };
    }
    console.error("[revenue] save key failed:", err);
    return { success: false as const, error: "Revenue verification failed unexpectedly. No revenue was stored." };
  }
}

async function connectRevenueKey(input: SaveKeyInput) {
  const user = await requireUser();
  const parsed = SaveKeySchema.parse(input);
  const provider = parseProviderId(parsed.provider);
  if (!provider) throw new FounderFacingError(`Unsupported payment provider "${parsed.provider}".`);

  const now = Date.now();
  if (now - (lastAttempt.get(user.id) ?? 0) < 8_000) {
    throw new FounderFacingError("Please wait a few seconds before verifying again.");
  }
  lastAttempt.set(user.id, now);

  let result: Awaited<ReturnType<typeof connectProvider>>;
  try {
    result = await connectProvider(user.id, provider, parsed.apiKey.trim(), (parsed.externalAccountId || "").trim());
  } catch (err) {
    if (err instanceof CredentialError || err instanceof ProviderUnavailableError) {
      // Nothing was stored. Surface the provider's reason to the founder.
      throw new FounderFacingError(`${err.message} No revenue was stored.`);
    }
    console.error("[revenue] connect failed:", err instanceof Error ? err.message : err);
    throw new FounderFacingError("Revenue verification failed unexpectedly. No revenue was stored.");
  }
  const { connection, verified } = result;

  // Attach to a product: the one requested (must be owned), or — when the
  // founder has exactly one live product without verified revenue — that one.
  let linkedProduct: { id: string; slug: string } | null = null;
  if (parsed.productId) {
    linkedProduct = await linkProductToConnection(user.id, connection.id, parsed.productId);
  } else {
    const candidates = await prisma.product.findMany({
      where: { ownerId: user.id, status: "LIVE", revenue: null },
      select: { id: true },
      take: 2,
    });
    if (candidates.length === 1) linkedProduct = await linkProductToConnection(user.id, connection.id, candidates[0].id);
  }

  if (user.username) revalidatePath(`/founder/${user.username}`);
  if (linkedProduct) revalidatePath(`/product/${linkedProduct.slug}`);
  revalidatePath("/profile");

  const mrrFormatted = formatUsdMonthly(verified.mrrCents);
  return {
    success: true as const,
    connectionId: connection.id,
    provider: connection.provider,
    keyHint: connection.keyHint,
    isEncryptedAtRest: true,
    mrrCents: verified.mrrCents,
    mrrFormatted,
    revenue12mCents: verified.revenue12mCents,
    subscribersCount: verified.activeSubscriptions,
    momGrowth: verified.momGrowthPct === null ? null : `${verified.momGrowthPct >= 0 ? "+" : ""}${verified.momGrowthPct}% MoM`,
    sourceCurrency: verified.sourceCurrency,
    linkedProductId: linkedProduct?.id ?? null,
    telemetryLog: [
      `Verified live ${connection.provider} data at ${new Date(verified.verifiedAt).toUTCString()}.`,
      `MRR: ${mrrFormatted} · ${verified.activeSubscriptions} active subscriptions.`,
      `How: ${verified.method}`,
      ...verified.warnings.map((w) => `Note: ${w}`),
      "Key stored encrypted (AES-256-GCM) and never shown again. Re-verified automatically every ~12 hours.",
    ].join("\n"),
    lastSyncedAt: connection.lastSyncedAt?.toISOString(),
  };
}

/** The founder's connections — masked key hints only, never the secret. */
export async function getPaymentApiKeys() {
  const user = await getCurrentUser();
  if (!user) return [];
  await ensureRevenueColumns();

  const connections = await prisma.revenueConnection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { revenues: { include: { product: { select: { id: true, name: true, slug: true } } } } },
  });

  return connections.map((conn) => ({
    id: conn.id,
    provider: conn.provider,
    providerId: providerIdFromEnum(conn.provider),
    externalAccountId: conn.externalAccountId,
    status: conn.status,
    lastSyncedAt: conn.lastSyncedAt?.toISOString(),
    lastSyncError: conn.lastSyncError,
    createdAt: conn.createdAt.toISOString(),
    apiKeyMasked: conn.keyHint || "•••• (re-verify to refresh)",
    mrrCents: conn.mrrCents,
    totalRevenueCents: conn.totalRevenueCents,
    mrrFormatted: conn.status === "ACTIVE" && conn.mrrCents > 0 ? formatUsdMonthly(conn.mrrCents) : "",
    sourceCurrency: conn.sourceCurrency,
    verificationMethod: conn.verificationMethod,
    revenues: conn.revenues.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product?.name,
      mrrCents: r.mrrCents,
      mrrFormatted: formatUsdMonthly(r.mrrCents),
      isVerified: r.isVerified,
    })),
  }));
}

/** Attach a connection's verified revenue to one of the founder's products. */
export async function linkRevenueToProduct(connectionId: string, productId: string) {
  const user = await requireUser();
  const product = await linkProductToConnection(user.id, connectionId, productId);
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/profile");
  return { success: true };
}

export async function deletePaymentApiKey(connectionId: string) {
  const user = await requireUser();
  const conn = await prisma.revenueConnection.findFirst({ where: { id: connectionId, userId: user.id } });
  if (!conn) return { success: false, error: "Connection not found" };
  // Cascades to ProductRevenue + snapshots: the "Verified" badge disappears with the key.
  await prisma.revenueConnection.delete({ where: { id: conn.id } });
  if (user.username) revalidatePath(`/founder/${user.username}`);
  revalidatePath("/profile");
  return { success: true };
}

/** Masked status for one provider — kept for older callers; never returns the key. */
export async function getPaymentApiKey(provider: string) {
  const user = await requireUser();
  const id = parseProviderId(provider);
  if (!id) return null;
  const { PROVIDER_ENUM } = await import("@/lib/revenue/store");
  await ensureRevenueColumns();
  const conn = await prisma.revenueConnection.findFirst({
    where: { userId: user.id, provider: PROVIDER_ENUM[id] },
    orderBy: { createdAt: "desc" },
  });
  if (!conn) return null;
  return {
    id: conn.id,
    provider: conn.provider,
    externalAccountId: conn.externalAccountId,
    status: conn.status,
    lastSyncedAt: conn.lastSyncedAt?.toISOString(),
    apiKeyMasked: conn.keyHint,
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
