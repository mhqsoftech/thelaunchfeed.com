import { requestJson } from "../http";
import { CredentialError, expectArray, monthlyFactor, toInt, TWELVE_MONTHS_MS, type Minor, type Payment, type ProviderAdapter } from "../types";

/**
 * Paystack — live secret key (sk_live_…). Amounts are in the currency's
 * subunit (kobo, pesewas, cents…) and converted at live FX rates — the old
 * fixed "÷15" overstated NGN revenue roughly 100×.
 */
const API = "https://api.paystack.co";
const MAX_PAGES = 20;

export const paystack: ProviderAdapter = {
  id: "paystack",
  validateCredential(raw) {
    const k = raw.trim();
    if (k.startsWith("sk_test_")) throw new CredentialError("That's a Paystack TEST key. Use your live secret key (sk_live_…).");
    if (k.startsWith("pk_")) throw new CredentialError("That's a public key. Paystack needs the live secret key (sk_live_…).");
    if (!k.startsWith("sk_live_")) throw new CredentialError("Paystack secret keys look like sk_live_….");
  },
  async fetchSnapshot(key) {
    const headers = { Authorization: `Bearer ${key.trim()}` };
    const mrr: Minor[] = [];
    let active = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await requestJson<any>("Paystack", `${API}/subscription?perPage=100&page=${page}`, { headers }, { what: "subscriptions" });
      const items = expectArray<any>(res?.data, "subscriptions", "Paystack");
      for (const s of items) {
        if (s.status !== "active") continue;
        active++;
        const amount = toInt(s.amount ?? s.plan?.amount);
        const factor = monthlyFactor(s.plan?.interval);
        if (amount === null || factor === null) continue;
        mrr.push({ minor: amount * factor, currency: String(s.plan?.currency || "NGN").toUpperCase() });
      }
      if (page >= (res?.meta?.pageCount ?? 1)) break;
    }

    const payments: Payment[] = [];
    const from = new Date(Date.now() - TWELVE_MONTHS_MS).toISOString();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await requestJson<any>("Paystack", `${API}/transaction?status=success&perPage=100&page=${page}&from=${encodeURIComponent(from)}`, { headers }, { what: "transactions" });
      const items = expectArray<any>(res?.data, "transactions", "Paystack");
      for (const t of items) {
        if (t.status !== "success") continue;
        const ts = Date.parse(t.paid_at || t.created_at);
        const amt = toInt(t.amount);
        if (amt && amt > 0 && Number.isFinite(ts)) payments.push({ tsMs: ts, minor: amt, currency: String(t.currency || "NGN").toUpperCase() });
      }
      if (page >= (res?.meta?.pageCount ?? 1)) break;
    }

    return {
      activeSubscriptions: active,
      mrr,
      payments,
      method: "Active Paystack subscriptions × amount, normalised by plan interval. Revenue = successful transactions, last 12 months (refunds not subtracted).",
      warnings: [],
    };
  },
};
