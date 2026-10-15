import { basicAuth, requestJson } from "../http";
import { CredentialError, expectArray, monthlyFactor, toInt, TWELVE_MONTHS_MS, type Minor, type Payment, type ProviderAdapter } from "../types";

/**
 * Chargebee — "site:api_key" (site = the subdomain in yoursite.chargebee.com).
 * The old code called api.chargebee.com, which doesn't exist, and multiplied
 * the already-in-cents `mrr` by 100. Test sites ("…-test") are rejected.
 */
const MAX_PAGES = 20;

function parse(raw: string) {
  const [site, key] = raw.trim().split(":");
  return { site: (site || "").trim().toLowerCase(), key: (key || "").trim() };
}

export const chargebee: ProviderAdapter = {
  id: "chargebee",
  validateCredential(raw) {
    const { site, key } = parse(raw);
    if (!site || !key) throw new CredentialError("Chargebee needs your site and a read-only key: paste as yoursite:live_xxx.");
    if (!/^[a-z0-9-]+$/.test(site)) throw new CredentialError("The Chargebee site is the subdomain only, e.g. acme for acme.chargebee.com.");
    if (site.endsWith("-test")) throw new CredentialError("That's a Chargebee TEST site. Use your live site.");
  },
  async fetchSnapshot(raw) {
    const { site, key } = parse(raw);
    const api = `https://${site}.chargebee.com/api/v2`;
    const headers = { Authorization: basicAuth(key) };
    const mrr: Minor[] = [];
    let active = 0;

    let offset: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ "status[is]": "active", limit: "100" });
      if (offset) q.set("offset", offset);
      const res = await requestJson<any>("Chargebee", `${api}/subscriptions?${q}`, { headers }, { what: "subscriptions" });
      for (const row of expectArray<any>(res?.list, "subscriptions", "Chargebee")) {
        const s = row.subscription ?? {};
        active++;
        const currency = String(s.currency_code || "USD").toUpperCase();
        const direct = toInt(s.mrr);
        if (direct !== null && direct > 0) {
          mrr.push({ minor: direct, currency });
          continue;
        }
        const factor = monthlyFactor(s.billing_period_unit, s.billing_period ?? 1);
        if (factor === null) continue;
        for (const item of s.subscription_items ?? []) {
          if (item.item_type && item.item_type !== "plan") continue;
          const amount = toInt(item.amount) ?? ((toInt(item.unit_price) ?? 0) * (item.quantity ?? 1));
          if (amount > 0) mrr.push({ minor: amount * factor, currency });
        }
      }
      offset = res?.next_offset;
      if (!offset) break;
    }

    const payments: Payment[] = [];
    const after = Math.floor((Date.now() - TWELVE_MONTHS_MS) / 1000);
    offset = undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ "status[is]": "paid", limit: "100", "date[after]": String(after) });
      if (offset) q.set("offset", offset);
      const res = await requestJson<any>("Chargebee", `${api}/invoices?${q}`, { headers }, { what: "invoices" });
      for (const row of expectArray<any>(res?.list, "invoices", "Chargebee")) {
        const inv = row.invoice ?? {};
        const paid = toInt(inv.amount_paid) ?? 0;
        if (paid > 0 && inv.date) payments.push({ tsMs: inv.date * 1000, minor: paid, currency: String(inv.currency_code || "USD").toUpperCase() });
      }
      offset = res?.next_offset;
      if (!offset) break;
    }

    return {
      activeSubscriptions: active,
      mrr,
      payments,
      method: "Chargebee's own subscription MRR (or plan items normalised by billing period). Revenue = paid invoices, last 12 months.",
      warnings: [],
    };
  },
};
