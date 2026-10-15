import { basicAuth, requestJson } from "../http";
import { CredentialError, ProviderUnavailableError, expectArray, monthlyFactor, toInt, TWELVE_MONTHS_MS, type Minor, type Payment, type ProviderAdapter } from "../types";

/**
 * Razorpay — "key_id:key_secret" (Basic auth). Test keys (rzp_test_) rejected.
 * The previous code invented $15/$10 per subscription and divided payments
 * by a fixed 84; now each subscription's plan is fetched for its real
 * amount/period and currency is converted at live FX rates.
 */
const API = "https://api.razorpay.com/v1";
const MAX_PAGES = 20;

export const razorpay: ProviderAdapter = {
  id: "razorpay",
  validateCredential(raw) {
    const [id, secret] = raw.trim().split(":");
    if (!id || !secret) throw new CredentialError("Razorpay needs both parts: paste as key_id:key_secret.");
    if (id.startsWith("rzp_test_")) throw new CredentialError("That's a Razorpay TEST key. Use live keys (rzp_live_…).");
    if (!id.startsWith("rzp_live_")) throw new CredentialError("Razorpay key IDs look like rzp_live_….");
  },
  async fetchSnapshot(cred) {
    const [id, secret] = cred.trim().split(":");
    const headers = { Authorization: basicAuth(id, secret) };
    const plans = new Map<string, { amount: number; currency: string; factor: number } | null>();
    const mrr: Minor[] = [];
    let active = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await requestJson<any>("Razorpay", `${API}/subscriptions?count=100&skip=${page * 100}`, { headers }, { what: "subscriptions" });
      const items = expectArray<any>(res?.items, "subscriptions", "Razorpay");
      for (const s of items) {
        if (s.status !== "active") continue;
        active++;
        const planId = String(s.plan_id || "");
        if (!planId) continue;
        let plan = plans.get(planId);
        if (plan === undefined) {
          const p = await requestJson<any>("Razorpay", `${API}/plans/${encodeURIComponent(planId)}`, { headers }, { what: "plans" });
          const amount = toInt(p?.item?.amount);
          const factor = monthlyFactor(p?.period, p?.interval ?? 1);
          plan = amount !== null && factor !== null ? { amount, currency: String(p.item.currency || "INR").toUpperCase(), factor } : null;
          plans.set(planId, plan);
          if (plans.size > 200) throw new ProviderUnavailableError("Too many distinct Razorpay plans to verify in one pass.");
        }
        if (plan) mrr.push({ minor: plan.amount * (s.quantity ?? 1) * plan.factor, currency: plan.currency });
      }
      if (items.length < 100) break;
    }

    const payments: Payment[] = [];
    const from = Math.floor((Date.now() - TWELVE_MONTHS_MS) / 1000);
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await requestJson<any>("Razorpay", `${API}/payments?count=100&skip=${page * 100}&from=${from}`, { headers }, { what: "payments" });
      const items = expectArray<any>(res?.items, "payments", "Razorpay");
      for (const p of items) {
        if (p.status !== "captured") continue;
        const net = (toInt(p.amount) ?? 0) - (toInt(p.amount_refunded) ?? 0);
        if (net > 0) payments.push({ tsMs: p.created_at * 1000, minor: net, currency: String(p.currency || "INR").toUpperCase() });
      }
      if (items.length < 100) break;
    }

    return {
      activeSubscriptions: active,
      mrr,
      payments,
      method: "Active Razorpay subscriptions × plan amount × quantity, normalised by plan period. Revenue = captured payments minus refunds, last 12 months.",
      warnings: [],
    };
  },
};
