/**
 * Revenue verification engine (server only).
 *
 *   verifyRevenue("stripe", "rk_live_…") → VerifiedRevenue | throws
 *
 * Throws CredentialError for bad / revoked / test-mode credentials and
 * ProviderUnavailableError for outages or unexpected responses. Callers must
 * treat any throw as "NOT verified" — there is no partial or estimated result.
 */

import { converter } from "./fx";
import {
  CredentialError,
  ProviderUnavailableError,
  type ProviderAdapter,
  type ProviderId,
  type RevenueHistoryPoint,
  type VerifiedRevenue,
} from "./types";
import { stripe } from "./providers/stripe";
import { paddle } from "./providers/paddle";
import { lemonsqueezy } from "./providers/lemonsqueezy";
import { polar } from "./providers/polar";
import { dodo } from "./providers/dodo";
import { razorpay } from "./providers/razorpay";
import { paystack } from "./providers/paystack";
import { chargebee } from "./providers/chargebee";
import { revenuecat } from "./providers/revenuecat";
import { gumroad } from "./providers/gumroad";
import { fastspring } from "./providers/fastspring";
import { square } from "./providers/square";
import { creem } from "./providers/creem";

export { CredentialError, ProviderUnavailableError };
export type { ProviderId, VerifiedRevenue, RevenueHistoryPoint };

export const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  stripe,
  paddle,
  lemonsqueezy,
  polar,
  dodopayments: dodo,
  razorpay,
  paystack,
  chargebee,
  revenuecat,
  gumroad,
  fastspring,
  square,
  creem,
};

/** Exact provider id from user input — no fuzzy matching, no silent default. */
export function parseProviderId(raw: string): ProviderId | null {
  const clean = (raw || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const aliases: Record<string, ProviderId> = { dodo: "dodopayments", lemon: "lemonsqueezy", polarsh: "polar", squaresubscriptions: "square", paddlebilling: "paddle" };
  if (clean in ADAPTERS) return clean as ProviderId;
  return aliases[clean] ?? null;
}

const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const ymd = (d: Date) => `${ym(d)}-${String(d.getUTCDate()).padStart(2, "0")}`;

function buckets(points: Array<{ tsMs: number; cents: number }>, kind: "month" | "day"): RevenueHistoryPoint[] {
  const now = new Date();
  const out: RevenueHistoryPoint[] = [];
  const index = new Map<string, number>();
  const n = kind === "month" ? 12 : 90;
  for (let i = n - 1; i >= 0; i--) {
    const d =
      kind === "month"
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = kind === "month" ? ym(d) : ymd(d);
    index.set(key, out.length);
    out.push({ period: key, amountCents: 0 });
  }
  for (const p of points) {
    const key = kind === "month" ? ym(new Date(p.tsMs)) : ymd(new Date(p.tsMs));
    const i = index.get(key);
    if (i !== undefined) out[i].amountCents += p.cents;
  }
  return out;
}

export async function verifyRevenue(provider: ProviderId, credential: string): Promise<VerifiedRevenue> {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new CredentialError("Unsupported payment provider.");
  adapter.validateCredential(credential);

  const snap = await adapter.fetchSnapshot(credential);
  const toUsd = await converter();

  // Dominant source currency by MRR (falls back to payments).
  const weight = new Map<string, number>();
  for (const m of snap.mrr) weight.set(m.currency, (weight.get(m.currency) ?? 0) + Math.abs(m.minor));
  if (weight.size === 0) for (const p of snap.payments) weight.set(p.currency, (weight.get(p.currency) ?? 0) + p.minor);
  const sourceCurrency = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  const mrrCents = Math.max(0, Math.round(snap.mrr.reduce((sum, m) => sum + toUsd(m.minor, m.currency), 0)));
  const points = snap.payments.map((p) => ({ tsMs: p.tsMs, cents: toUsd(p.minor, p.currency) }));
  let revenue12mCents = points.reduce((s, p) => s + p.cents, 0);
  if (snap.trailingRevenue && points.length === 0) {
    revenue12mCents = toUsd(snap.trailingRevenue.minor, snap.trailingRevenue.currency);
  }

  const monthlyHistory = points.length ? buckets(points, "month") : [];
  const dailyHistory = points.length ? buckets(points, "day") : [];
  let momGrowthPct: number | null = null;
  if (monthlyHistory.length >= 3) {
    // Compare the last two COMPLETE months (the current month is partial).
    const prev = monthlyHistory[monthlyHistory.length - 3].amountCents;
    const last = monthlyHistory[monthlyHistory.length - 2].amountCents;
    if (prev > 0) momGrowthPct = Math.round(((last - prev) / prev) * 1000) / 10;
  }

  return {
    provider,
    mrrCents,
    arrCents: mrrCents * 12,
    revenue12mCents,
    activeSubscriptions: snap.activeSubscriptions,
    sourceCurrency,
    momGrowthPct,
    monthlyHistory,
    dailyHistory,
    method: snap.method + (sourceCurrency !== "USD" ? ` Converted from ${sourceCurrency} to USD at today's exchange rate.` : ""),
    warnings: snap.warnings,
    verifiedAt: new Date().toISOString(),
  };
}

export { formatUsdMonthly } from "./format";
