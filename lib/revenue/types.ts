/**
 * Revenue verification engine — shared types.
 *
 * Trust rules every provider adapter follows:
 *  1. LIVE MODE ONLY. Test / sandbox credentials are rejected with a
 *     CredentialError — otherwise anyone could mint fake "verified" MRR.
 *  2. FAIL CLOSED. Any response that doesn't match the documented shape throws
 *     ProviderUnavailableError. We never guess, default, or estimate a number.
 *  3. NATIVE UNITS. Amounts are kept in the provider's minor units + ISO
 *     currency until the very end, then converted to USD cents at real FX rates.
 */

export type ProviderId =
  | "stripe"
  | "paddle"
  | "lemonsqueezy"
  | "polar"
  | "dodopayments"
  | "razorpay"
  | "paystack"
  | "chargebee"
  | "revenuecat"
  | "gumroad"
  | "fastspring"
  | "square"
  | "creem";

/** The key/credentials are wrong, revoked, lack permissions, or are test-mode. Not retryable. */
export class CredentialError extends Error {
  readonly kind = "credential";
}

/** The provider is down, rate-limiting, or answered with something unexpected. Retry later. */
export class ProviderUnavailableError extends Error {
  readonly kind = "unavailable";
}

export type Minor = { minor: number; currency: string };

export type Payment = { tsMs: number; minor: number; currency: string };

/** What an adapter returns — raw, per-currency, nothing converted yet. */
export interface ProviderSnapshot {
  activeSubscriptions: number;
  /** Monthly-normalised recurring revenue contributions, per currency. */
  mrr: Minor[];
  /** Collected payments (net of refunds where the API exposes them), last ~12 months. */
  payments: Payment[];
  /** Plain-English description of how MRR was computed, shown to the founder. */
  method: string;
  warnings: string[];
  /** Some providers report a trailing revenue figure instead of a payment list. */
  trailingRevenue?: Minor & { days: number };
}

export interface RevenueHistoryPoint {
  period: string; // "YYYY-MM" or "YYYY-MM-DD" (UTC)
  amountCents: number; // USD cents
}

/** Normalised, USD-denominated result stored on the connection. */
export interface VerifiedRevenue {
  provider: ProviderId;
  mrrCents: number;
  arrCents: number;
  /** Collected revenue over the last 12 months (USD cents). */
  revenue12mCents: number;
  activeSubscriptions: number;
  /** Dominant source currency (e.g. "INR"); amounts above are converted to USD. */
  sourceCurrency: string;
  momGrowthPct: number | null;
  monthlyHistory: RevenueHistoryPoint[];
  dailyHistory: RevenueHistoryPoint[];
  method: string;
  warnings: string[];
  verifiedAt: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  /** Throws CredentialError for obviously wrong / test-mode credentials before any network call. */
  validateCredential(raw: string): void;
  fetchSnapshot(credential: string): Promise<ProviderSnapshot>;
}

/** Monthly multiplier for a billing interval of `count` units. */
export function monthlyFactor(unit: string, count = 1): number | null {
  const u = (unit || "").toLowerCase().replace(/s$/, "");
  const c = Number.isFinite(count) && count > 0 ? count : 1;
  const perMonth: Record<string, number> = {
    day: 365.25 / 12,
    daily: 365.25 / 12,
    week: 52.1775 / 12,
    weekly: 52.1775 / 12,
    month: 1,
    monthly: 1,
    quarter: 1 / 3,
    quarterly: 1 / 3,
    biannually: 1 / 6,
    year: 1 / 12,
    yearly: 1 / 12,
    annually: 1 / 12,
    annual: 1 / 12,
  };
  const f = perMonth[u];
  return f === undefined ? null : f / c;
}

export const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

/** Require a field to be an array — anything else means the API changed; fail closed. */
export function expectArray<T = any>(value: unknown, what: string, provider: string): T[] {
  if (!Array.isArray(value)) {
    throw new ProviderUnavailableError(`${provider} returned an unexpected response for ${what}. Nothing was verified.`);
  }
  return value as T[];
}

export function toInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}
