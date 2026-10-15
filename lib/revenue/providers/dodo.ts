import { requestJson } from "../http";
import { expectArray, monthlyFactor, toInt, TWELVE_MONTHS_MS, CredentialError, type Minor, type Payment, type ProviderAdapter } from "../types";

/**
 * Dodo Payments — live-mode API key. Only the LIVE host is queried (the old
 * implementation silently fell back to test mode, which let test data count
 * as "verified"). MRR uses the payment frequency, not the subscription length.
 */
const API = "https://live.dodopayments.com";
const MAX_PAGES = 20;

export const dodo: ProviderAdapter = {
  id: "dodopayments",
  validateCredential(raw) {
    if (raw.trim().length < 16) throw new CredentialError("Paste your Dodo Payments live-mode API key (Developer → API Keys, Live mode).");
  },
  async fetchSnapshot(key) {
    const headers = { Authorization: `Bearer ${key.trim()}` };
    const mrr: Minor[] = [];
    let active = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await requestJson<any>("Dodo Payments", `${API}/subscriptions?status=active&page_size=100&page_number=${page}`, { headers }, { what: "subscriptions" });
      const items = expectArray<any>(res?.items, "subscriptions", "Dodo Payments");
      for (const s of items) {
        if (s.status !== "active") continue;
        active++;
        const amount = toInt(s.recurring_pre_tax_amount);
        const factor = monthlyFactor(s.payment_frequency_interval, s.payment_frequency_count ?? 1);
        if (amount === null || factor === null) continue;
        mrr.push({ minor: amount * (s.quantity ?? 1) * factor, currency: String(s.currency || "USD").toUpperCase() });
      }
      if (items.length < 100) break;
    }

    const payments: Payment[] = [];
    const since = new Date(Date.now() - TWELVE_MONTHS_MS).toISOString();
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await requestJson<any>(
        "Dodo Payments",
        `${API}/payments?status=succeeded&page_size=100&page_number=${page}&created_at_gte=${encodeURIComponent(since)}`,
        { headers },
        { what: "payments" }
      );
      const items = expectArray<any>(res?.items, "payments", "Dodo Payments");
      for (const p of items) {
        if (p.status !== "succeeded") continue;
        const ts = Date.parse(p.created_at);
        const amt = toInt(p.total_amount);
        if (amt && amt > 0 && Number.isFinite(ts)) payments.push({ tsMs: ts, minor: amt, currency: String(p.currency || "USD").toUpperCase() });
      }
      if (items.length < 100) break;
    }

    return {
      activeSubscriptions: active,
      mrr,
      payments,
      method: "Active Dodo subscriptions × pre-tax recurring amount, normalised by payment frequency. Revenue = succeeded payments, last 12 months (refunds not subtracted).",
      warnings: [],
    };
  },
};
