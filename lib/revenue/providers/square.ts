import { requestJson } from "../http";
import { CredentialError, ProviderUnavailableError, expectArray, toInt, TWELVE_MONTHS_MS, type Minor, type Payment, type ProviderAdapter } from "../types";

/**
 * Square — production access token (EAAA…). Sandbox tokens only work on the
 * sandbox host, so they fail here. Subscription prices come from the plan
 * variation's phases in the Catalog (the old code assumed $25 when a price
 * override was missing).
 */
const API = "https://connect.squareup.com/v2";
const VERSION = "2024-10-17";
const MAX_PAGES = 20;

const CADENCE_PER_MONTH: Record<string, number> = {
  DAILY: 365.25 / 12,
  WEEKLY: 52.1775 / 12,
  EVERY_TWO_WEEKS: 26.0888 / 12,
  THIRTY_DAYS: 365.25 / 12 / 30,
  SIXTY_DAYS: 365.25 / 12 / 60,
  NINETY_DAYS: 365.25 / 12 / 90,
  MONTHLY: 1,
  EVERY_TWO_MONTHS: 1 / 2,
  QUARTERLY: 1 / 3,
  EVERY_FOUR_MONTHS: 1 / 4,
  EVERY_SIX_MONTHS: 1 / 6,
  ANNUAL: 1 / 12,
  EVERY_TWO_YEARS: 1 / 24,
};

export const square: ProviderAdapter = {
  id: "square",
  validateCredential(raw) {
    const k = raw.trim();
    if (k.startsWith("sq0idp-") || k.startsWith("sandbox-")) throw new CredentialError("That's an application ID / sandbox credential. Paste a PRODUCTION access token (EAAA…).");
    if (k.length < 30) throw new CredentialError("Square production access tokens look like EAAA….");
  },
  async fetchSnapshot(token) {
    const headers = { Authorization: `Bearer ${token.trim()}`, "Square-Version": VERSION, "Content-Type": "application/json" };
    const variations = new Map<string, { minor: number; currency: string; factor: number } | null>();
    const mrr: Minor[] = [];
    let active = 0;

    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await requestJson<any>(
        "Square",
        `${API}/subscriptions/search`,
        { method: "POST", headers, body: JSON.stringify({ limit: 100, cursor, query: { filter: {} } }) },
        { what: "subscriptions" }
      );
      const subs = res?.subscriptions === undefined ? [] : expectArray<any>(res.subscriptions, "subscriptions", "Square");
      for (const s of subs) {
        if (s.status !== "ACTIVE") continue;
        active++;
        const varId = String(s.plan_variation_id || "");
        let v = varId ? variations.get(varId) : null;
        if (varId && v === undefined) {
          const obj = await requestJson<any>("Square", `${API}/catalog/object/${encodeURIComponent(varId)}`, { headers }, { what: "subscription plans" });
          const phases: any[] = obj?.object?.subscription_plan_variation_data?.phases ?? [];
          const ongoing = phases.find((ph) => ph.periods == null) ?? phases[phases.length - 1];
          const money = ongoing?.pricing?.price_money ?? ongoing?.recurring_price_money;
          const factor = CADENCE_PER_MONTH[ongoing?.cadence];
          v = money && factor ? { minor: toInt(money.amount) ?? 0, currency: String(money.currency).toUpperCase(), factor } : null;
          variations.set(varId, v);
          if (variations.size > 200) throw new ProviderUnavailableError("Too many Square plan variations to verify in one pass.");
        }
        const override = s.price_override_money;
        if (override && v) mrr.push({ minor: (toInt(override.amount) ?? 0) * v.factor, currency: String(override.currency).toUpperCase() });
        else if (v) mrr.push({ minor: v.minor * v.factor, currency: v.currency });
      }
      cursor = res?.cursor;
      if (!cursor) break;
    }

    const payments: Payment[] = [];
    const begin = new Date(Date.now() - TWELVE_MONTHS_MS).toISOString();
    cursor = undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ begin_time: begin, limit: "100" });
      if (cursor) q.set("cursor", cursor);
      const res = await requestJson<any>("Square", `${API}/payments?${q}`, { headers }, { what: "payments" });
      const list = res?.payments === undefined ? [] : expectArray<any>(res.payments, "payments", "Square");
      for (const p of list) {
        if (p.status !== "COMPLETED") continue;
        const net = (toInt(p.amount_money?.amount) ?? 0) - (toInt(p.refunded_money?.amount) ?? 0);
        const ts = Date.parse(p.created_at);
        if (net > 0 && Number.isFinite(ts)) payments.push({ tsMs: ts, minor: net, currency: String(p.amount_money.currency).toUpperCase() });
      }
      cursor = res?.cursor;
      if (!cursor) break;
    }

    return {
      activeSubscriptions: active,
      mrr,
      payments,
      method: "Active Square subscriptions priced from their catalog plan (or price override), normalised by cadence. Revenue = completed payments minus refunds, last 12 months.",
      warnings: [],
    };
  },
};
