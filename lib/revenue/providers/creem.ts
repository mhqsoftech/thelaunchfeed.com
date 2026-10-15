import { requestJson } from "../http";
import { CredentialError, ProviderUnavailableError, toInt, TWELVE_MONTHS_MS, type Payment, type ProviderAdapter } from "../types";

/**
 * Creem — live API key (creem_…; test keys creem_test_… are rejected).
 * Creem has no "list subscriptions with price" endpoint, so MRR is reported
 * as recurring (subscription) transactions collected in the last 30 days.
 */
const API = "https://api.creem.io/v1";
const MAX_PAGES = 30;

export const creem: ProviderAdapter = {
  id: "creem",
  validateCredential(raw) {
    const k = raw.trim();
    if (k.startsWith("creem_test_")) throw new CredentialError("That's a Creem TEST key. Use your live API key.");
    if (!k.startsWith("creem_")) throw new CredentialError("Creem API keys look like creem_….");
  },
  async fetchSnapshot(key) {
    const headers = { "x-api-key": key.trim() };
    const payments: Payment[] = [];
    const recurring30: Payment[] = [];
    const subs = new Set<string>();
    const cutoff = Date.now() - TWELVE_MONTHS_MS;
    const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await requestJson<any>("Creem", `${API}/transactions/search?page_number=${page}&page_size=100`, { headers }, { what: "transactions" });
      const items = res?.items;
      if (!Array.isArray(items)) throw new ProviderUnavailableError("Creem returned an unexpected response for transactions. Nothing was verified.");
      let reachedOld = false;
      for (const t of items) {
        if (t.mode && t.mode !== "live" && t.mode !== "prod") continue;
        const raw = t.created_at;
        const ts = typeof raw === "number" ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(raw);
        if (!Number.isFinite(ts)) continue;
        if (ts < cutoff) {
          reachedOld = true;
          continue;
        }
        if (t.status && t.status !== "paid" && t.status !== "succeeded") continue;
        const amt = (toInt(t.amount_paid ?? t.amount) ?? 0) - (toInt(t.refunded_amount) ?? 0);
        if (amt <= 0) continue;
        const p = { tsMs: ts, minor: amt, currency: String(t.currency || "USD").toUpperCase() };
        payments.push(p);
        if (t.subscription && ts >= cutoff30) {
          recurring30.push(p);
          subs.add(String(typeof t.subscription === "string" ? t.subscription : t.subscription.id));
        }
      }
      const totalPages = res?.pagination?.total_pages ?? res?.pagination?.last_page;
      if (reachedOld || items.length === 0 || (totalPages && page >= totalPages)) break;
    }

    return {
      activeSubscriptions: subs.size,
      mrr: recurring30.map((p) => ({ minor: p.minor, currency: p.currency })),
      payments,
      method: "Creem has no subscription-price API, so MRR = subscription payments collected in the last 30 days. Revenue = paid transactions, last 12 months.",
      warnings: ["Creem MRR is a trailing-30-day figure."],
    };
  },
};
