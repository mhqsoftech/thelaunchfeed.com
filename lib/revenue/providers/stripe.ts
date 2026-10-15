import { requestJson } from "../http";
import { CredentialError, expectArray, monthlyFactor, TWELVE_MONTHS_MS, type Minor, type Payment, type ProviderAdapter } from "../types";

/**
 * Stripe — restricted key (rk_live_) with READ on Subscriptions + Charges,
 * or a secret key (sk_live_). Test keys are rejected.
 * MRR: active subscriptions × item price × quantity, normalised by
 * interval/interval_count, minus percent/amount coupons.
 */
const API = "https://api.stripe.com/v1";
const MAX_PAGES = 20;

export const stripe: ProviderAdapter = {
  id: "stripe",
  validateCredential(raw) {
    const k = raw.trim();
    if (/^(sk|rk)_test_/.test(k)) throw new CredentialError("That's a Stripe TEST key. Use a live restricted key (rk_live_…) so real revenue can be verified.");
    if (/^pk_/.test(k)) throw new CredentialError("That's a publishable key. Create a restricted key (rk_live_…) with read access to Subscriptions and Charges.");
    if (!/^(sk|rk)_live_[A-Za-z0-9]+$/.test(k)) throw new CredentialError("Stripe keys look like rk_live_… (recommended) or sk_live_….");
  },
  async fetchSnapshot(key) {
    const headers = { Authorization: `Bearer ${key.trim()}` };
    const mrr: Minor[] = [];
    const warnings: string[] = [];
    let active = 0;

    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ status: "active", limit: "100" });
      if (after) q.set("starting_after", after);
      const res = await requestJson<any>("Stripe", `${API}/subscriptions?${q}`, { headers }, { what: "subscriptions" });
      const subs = expectArray<any>(res?.data, "subscriptions", "Stripe");
      for (const sub of subs) {
        if (sub.livemode === false) throw new CredentialError("Stripe returned test-mode data. Use a live-mode key.");
        active++;
        const coupon = sub.discount?.coupon;
        for (const item of sub.items?.data ?? []) {
          const price = item.price ?? item.plan;
          const unit = price?.unit_amount ?? price?.amount;
          const interval = price?.recurring?.interval ?? price?.interval;
          const count = price?.recurring?.interval_count ?? price?.interval_count ?? 1;
          const factor = monthlyFactor(interval, count);
          if (typeof unit !== "number" || factor === null) {
            warnings.push("Some Stripe prices use tiered/metered billing and were left out of MRR.");
            continue;
          }
          let periodAmount = unit * (item.quantity ?? 1);
          if (coupon?.percent_off) periodAmount *= 1 - coupon.percent_off / 100;
          if (coupon?.amount_off && coupon.currency === price.currency) periodAmount = Math.max(0, periodAmount - coupon.amount_off);
          mrr.push({ minor: periodAmount * factor, currency: String(price.currency).toUpperCase() });
        }
      }
      if (!res.has_more || subs.length === 0) break;
      after = subs[subs.length - 1].id;
      if (page === MAX_PAGES - 1) warnings.push("Over 2,000 active subscriptions — MRR covers the first 2,000.");
    }

    const payments: Payment[] = [];
    const since = Math.floor((Date.now() - TWELVE_MONTHS_MS) / 1000);
    after = undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ limit: "100", "created[gte]": String(since) });
      if (after) q.set("starting_after", after);
      const res = await requestJson<any>("Stripe", `${API}/charges?${q}`, { headers }, { what: "charges" });
      const charges = expectArray<any>(res?.data, "charges", "Stripe");
      for (const c of charges) {
        if (c.livemode === false) throw new CredentialError("Stripe returned test-mode data. Use a live-mode key.");
        if (c.status !== "succeeded" || !c.paid) continue;
        const net = (c.amount ?? 0) - (c.amount_refunded ?? 0);
        if (net > 0) payments.push({ tsMs: c.created * 1000, minor: net, currency: String(c.currency).toUpperCase() });
      }
      if (!res.has_more || charges.length === 0) break;
      after = charges[charges.length - 1].id;
    }

    return {
      activeSubscriptions: active,
      mrr,
      payments,
      method: "Active Stripe subscriptions × price × quantity, normalised to a month, after coupons. Revenue = succeeded charges minus refunds, last 12 months.",
      warnings: [...new Set(warnings)],
    };
  },
};
