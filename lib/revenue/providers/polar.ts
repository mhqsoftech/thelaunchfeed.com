import { requestJson } from "../http";
import { CredentialError, expectArray, monthlyFactor, toInt, TWELVE_MONTHS_MS, type Minor, type Payment, type ProviderAdapter } from "../types";

/**
 * Polar — organization access token (polar_oat_…). Production API only, so
 * sandbox tokens fail authentication.
 */
const API = "https://api.polar.sh/v1";
const MAX_PAGES = 20;

export const polar: ProviderAdapter = {
  id: "polar",
  validateCredential(raw) {
    if (!/^polar_(oat|pat)_/.test(raw.trim())) throw new CredentialError("Polar tokens look like polar_oat_… (Settings → Developers → Organization access token, read scopes).");
  },
  async fetchSnapshot(key) {
    const headers = { Authorization: `Bearer ${key.trim()}` };
    const mrr: Minor[] = [];
    let active = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await requestJson<any>("Polar", `${API}/subscriptions/?active=true&limit=100&page=${page}`, { headers }, { what: "subscriptions" });
      const items = expectArray<any>(res?.items, "subscriptions", "Polar");
      for (const sub of items) {
        if (sub.status !== "active") continue;
        active++;
        const amount = toInt(sub.amount);
        const factor = monthlyFactor(sub.recurring_interval, sub.recurring_interval_count ?? 1);
        if (amount === null || factor === null) continue;
        mrr.push({ minor: amount * factor, currency: String(sub.currency || "USD").toUpperCase() });
      }
      if (page >= (res?.pagination?.max_page ?? 1)) break;
    }

    const payments: Payment[] = [];
    const cutoff = Date.now() - TWELVE_MONTHS_MS;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await requestJson<any>("Polar", `${API}/orders/?limit=100&page=${page}&sorting=-created_at`, { headers }, { what: "orders" });
      const items = expectArray<any>(res?.items, "orders", "Polar");
      let reachedOld = false;
      for (const o of items) {
        const ts = Date.parse(o.created_at);
        if (!Number.isFinite(ts)) continue;
        if (ts < cutoff) {
          reachedOld = true;
          continue;
        }
        if (o.paid === false || o.status === "pending") continue;
        const total = toInt(o.total_amount ?? o.amount) ?? 0;
        const net = total - (toInt(o.refunded_amount) ?? 0);
        if (net > 0) payments.push({ tsMs: ts, minor: net, currency: String(o.currency || "USD").toUpperCase() });
      }
      if (reachedOld || page >= (res?.pagination?.max_page ?? 1)) break;
    }

    return {
      activeSubscriptions: active,
      mrr,
      payments,
      method: "Active Polar subscriptions × amount, normalised by recurring interval. Revenue = paid orders minus refunds, last 12 months.",
      warnings: [],
    };
  },
};
