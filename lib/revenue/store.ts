/**
 * Persistence for verified revenue — shared by the founder-facing actions and
 * the background re-sync job. Server only.
 */

import { prisma } from "@/lib/db";
import type { RevenueProvider } from "@prisma/client";
import { decryptPaymentApiKey, encryptPaymentApiKey, maskSecret, needsReencryption, paymentKeyAad } from "@/lib/crypto";
import { ensureRevenueColumns } from "@/lib/jobs/schema";
import { CredentialError, ProviderUnavailableError, verifyRevenue, type ProviderId, type VerifiedRevenue } from "./index";

export const PROVIDER_ENUM: Record<ProviderId, RevenueProvider> = {
  stripe: "STRIPE",
  paddle: "PADDLE",
  lemonsqueezy: "LEMONSQUEEZY",
  polar: "POLAR",
  dodopayments: "DODOPAYMENTS",
  razorpay: "RAZORPAY",
  paystack: "PAYSTACK",
  chargebee: "CHARGEBEE",
  revenuecat: "REVENUECAT",
  gumroad: "GUMROAD",
  fastspring: "FASTSPRING",
  square: "SQUARE",
  creem: "CREEM",
};

export function providerIdFromEnum(e: RevenueProvider): ProviderId {
  return (Object.entries(PROVIDER_ENUM).find(([, v]) => v === e)?.[0] ?? "stripe") as ProviderId;
}

/** A verified figure older than this stops being shown as "Verified". */
export const VERIFIED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function metricsData(v: VerifiedRevenue) {
  return {
    mrrCents: v.mrrCents,
    arrCents: v.arrCents,
    totalRevenueCents: v.revenue12mCents,
    currency: "usd",
    momGrowthPct: v.momGrowthPct,
    monthlyHistoryJson: v.monthlyHistory as any,
    dailyHistoryJson: v.dailyHistory as any,
    sourceCurrency: v.sourceCurrency,
    verificationMethod: [v.method, ...v.warnings].join(" "),
  };
}

/** Push fresh numbers onto every product linked to a connection (+ history point). */
async function refreshLinkedProducts(connectionId: string, v: VerifiedRevenue) {
  const linked = await prisma.productRevenue.findMany({ where: { connectionId }, select: { id: true } });
  const now = new Date();
  for (const r of linked) {
    await prisma.productRevenue.update({
      where: { id: r.id },
      data: {
        mrrCents: v.mrrCents,
        arrCents: v.arrCents,
        totalRevenueCents: v.revenue12mCents,
        currency: "usd",
        momGrowthPct: v.momGrowthPct,
        customerCount: v.activeSubscriptions,
        isVerified: true,
        verifiedAt: now,
        syncedAt: now,
      },
    });
    await prisma.revenueSnapshot.create({ data: { revenueId: r.id, mrrCents: v.mrrCents, capturedAt: now } });
  }
}

/**
 * Verify a credential and, only if the provider confirms LIVE data, store it
 * (encrypted, owner-bound) together with the verified numbers.
 */
export async function connectProvider(userId: string, provider: ProviderId, credential: string, externalAccountId = "") {
  await ensureRevenueColumns();
  const verified = await verifyRevenue(provider, credential); // throws → nothing stored
  const providerEnum = PROVIDER_ENUM[provider];
  const accessToken = encryptPaymentApiKey(credential, paymentKeyAad(userId, providerEnum));
  const now = new Date();

  const connection = await prisma.revenueConnection.upsert({
    where: { userId_provider_externalAccountId: { userId, provider: providerEnum, externalAccountId } },
    create: {
      userId,
      provider: providerEnum,
      externalAccountId,
      accessToken,
      keyHint: maskSecret(credential),
      status: "ACTIVE",
      lastSyncedAt: now,
      lastSyncError: null,
      ...metricsData(verified),
    },
    update: {
      accessToken,
      keyHint: maskSecret(credential),
      status: "ACTIVE",
      lastSyncedAt: now,
      lastSyncError: null,
      ...metricsData(verified),
    },
  });
  await refreshLinkedProducts(connection.id, verified);
  return { connection, verified };
}

/** Link (or move) a product's verified revenue to a connection — both must belong to the user. */
export async function linkProductToConnection(userId: string, connectionId: string, productId: string) {
  const [connection, product] = await Promise.all([
    prisma.revenueConnection.findFirst({ where: { id: connectionId, userId } }),
    prisma.product.findFirst({
      where: { id: productId, OR: [{ ownerId: userId }, { makers: { some: { userId } } }] },
      select: { id: true, slug: true },
    }),
  ]);
  if (!connection) throw new Error("Revenue connection not found.");
  if (!product) throw new Error("You can only attach revenue to products you own.");
  if (connection.status !== "ACTIVE") throw new Error("Reconnect this provider before linking it to a product.");

  const now = new Date();
  const data = {
    connectionId: connection.id,
    mrrCents: connection.mrrCents,
    arrCents: connection.arrCents,
    totalRevenueCents: connection.totalRevenueCents,
    currency: "usd",
    momGrowthPct: connection.momGrowthPct,
    isVerified: true,
    verifiedAt: connection.lastSyncedAt ?? now,
    syncedAt: connection.lastSyncedAt ?? now,
  };
  const rev = await prisma.productRevenue.upsert({
    where: { productId: product.id },
    create: { productId: product.id, ...data },
    update: data,
  });
  await prisma.revenueSnapshot.create({ data: { revenueId: rev.id, mrrCents: connection.mrrCents } });
  return product;
}

/**
 * Re-verify a stored connection (background job). Revoked / invalid keys
 * immediately un-verify every linked product; outages only do so once the
 * last good verification is older than VERIFIED_MAX_AGE_MS.
 */
export async function resyncConnection(connectionId: string) {
  await ensureRevenueColumns();
  const conn = await prisma.revenueConnection.findUnique({ where: { id: connectionId } });
  if (!conn || conn.status === "REVOKED") return { skipped: true };
  const provider = providerIdFromEnum(conn.provider);
  const aad = paymentKeyAad(conn.userId, conn.provider);

  let credential: string;
  try {
    credential = decryptPaymentApiKey(conn.accessToken, conn.accessToken.startsWith("enc:v2:") ? aad : undefined);
  } catch {
    await markFailed(conn.id, "The stored key can't be decrypted. Please reconnect this provider.", { revoked: true, unverify: true });
    return { ok: false, reason: "decrypt" };
  }

  try {
    const verified = await verifyRevenue(provider, credential);
    await prisma.revenueConnection.update({
      where: { id: conn.id },
      data: {
        status: "ACTIVE",
        lastSyncedAt: new Date(),
        lastSyncError: null,
        ...(needsReencryption(conn.accessToken) ? { accessToken: encryptPaymentApiKey(credential, aad) } : {}),
        ...(conn.keyHint ? {} : { keyHint: maskSecret(credential) }),
        ...metricsData(verified),
      },
    });
    await refreshLinkedProducts(conn.id, verified);
    return { ok: true, mrrCents: verified.mrrCents };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof CredentialError) {
      await markFailed(conn.id, message, { revoked: true, unverify: true });
      return { ok: false, reason: "credential" };
    }
    const stale = !conn.lastSyncedAt || Date.now() - conn.lastSyncedAt.getTime() > VERIFIED_MAX_AGE_MS;
    await markFailed(conn.id, message, { revoked: false, unverify: stale });
    if (err instanceof ProviderUnavailableError) return { ok: false, reason: "unavailable" };
    throw err;
  }
}

async function markFailed(connectionId: string, message: string, opts: { revoked: boolean; unverify: boolean }) {
  await prisma.revenueConnection.update({
    where: { id: connectionId },
    data: { status: opts.revoked ? "REVOKED" : "ERROR", lastSyncError: message.slice(0, 1000) },
  });
  const unverify = opts.unverify;
  if (unverify) {
    await prisma.productRevenue.updateMany({ where: { connectionId }, data: { isVerified: false } });
  }
}

/**
 * Remove secrets that older builds wrote into submission/product `details`
 * (the submit form used to save the raw API key there in plaintext).
 */
export async function scrubSecretsFromDetails() {
  const keys = ["apiKey", "apiSecret", "secretKey", "revenueApiKey", "stripeApiKey"];
  const arr = `ARRAY[${keys.map((k) => `'${k}'`).join(",")}]`;
  const strip = keys.map((k) => ` - '${k}'`).join("");
  const sub = await prisma.$executeRawUnsafe(`UPDATE "Submission" SET "details" = "details"${strip} WHERE "details" ?| ${arr}`);
  const prod = await prisma.$executeRawUnsafe(`UPDATE "Product" SET "details" = "details"${strip} WHERE "details" ?| ${arr}`);
  return { submissions: sub, products: prod };
}
