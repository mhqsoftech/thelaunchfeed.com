import { requestJson } from "../http";
import { CredentialError, ProviderUnavailableError, expectArray, monthlyFactor, toInt, TWELVE_MONTHS_MS, type Minor, type Payment, type ProviderAdapter } from "../types";

/**
 * Lemon Squeezy — API key (a long JWT). Test-mode data is rejected.
 * Subscriptions don't carry a price, so each subscription's
 * first_subscription_item.price_id is resolved via /v1/prices/{id}
 * (unit_price in cents + renewal interval). Store currency comes from /v1/stores.
 */
const API = "https://api.lemonsqueezy.com/v1";
const MAX_PAGES = 20;
const HEADERS = (key: string) => ({ Authorization: `Bearer ${key.trim()}`, Accept: "application/vnd.api+json" });

export const lemonsqueezy: ProviderAdapter = {
  id: "lemonsqueezy",
  validateCredential(raw) {
    if (raw.trim().split(".").length !== 3) throw new CredentialError("Lemon Squeezy API keys are long tokens (they start with eyJ…). Create one under Settings → API.");
  },
  async fetchSnapshot(key) {
    const headers = HEADERS(key);
    const stores = await requestJson<any>("Lemon Squeezy", `${API}/stores`, { headers }, { what: "stores" });
    const storeCurrency = new Map<string, string>();
    for (const s of expectArray<any>(stores?.data, "stores", "Lemon Squeezy")) {
      storeCurrency.set(String(s.id), String(s.attributes?.currency || "USD").toUpperCase());
    }

    const priceCache = new Map<string, { unit: number; factor: number } | null>();
    const mrr: Minor[] = [];
    let active = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await requestJson<any>(
        "Lemon Squeezy",
        `${API}/subscriptions?filter[status]=active&page[size]=100&page[number]=${page}`,
        { headers },
        { what: "subscriptions" }
      );
      const subs = expectArray<any>(res?.data, "subscriptions", "Lemon Squeezy");
      for (const sub of subs) {
        const a = sub.attributes ?? {};
        if (a.test_mode) throw new CredentialError("That Lemon Squeezy key is in test mode. Use a live-mode API key.");
        active++;
        const priceId = a.first_subscription_item?.price_id;
        if (!priceId) continue;
        let price = priceCache.get(String(priceId));
        if (price === undefined) {
          const p = await requestJson<any>("Lemon Squeezy", `${API}/prices/${priceId}`, { headers }, { what: "prices" });
          const pa = p?.data?.attributes;
          const unit = toInt(pa?.unit_price);
          const factor = monthlyFactor(pa?.renewal_interval_unit, pa?.renewal_interval_quantity ?? 1);
          price = unit !== null && factor !== null ? { unit, factor } : null;
          priceCache.set(String(priceId), price);
          if (priceCache.size > 200) throw new ProviderUnavailableError("Too many distinct Lemon Squeezy prices to verify in one pass.");
        }
        if (!price) continue;
        const currency = storeCurrency.get(String(a.store_id)) ?? "USD";
        mrr.push({ minor: price.unit * (a.first_subscription_item?.quantity ?? 1) * price.factor, currency });
      }
      if (page >= (res?.meta?.page?.lastPage ?? 1)) break;
    }

    const payments: Payment[] = [];
    const cutoff = Date.now() - TWELVE_MONTHS_MS;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await requestJson<any>("Lemon Squeezy", `${API}/orders?page[size]=100&page[number]=${page}&sort=-createdAt`, { headers }, { what: "orders" });
      const orders = expectArray<any>(res?.data, "orders", "Lemon Squeezy");
      let reachedOld = false;
      for (const o of orders) {
        const a = o.attributes ?? {};
        if (a.test_mode) continue;
        const ts = Date.parse(a.created_at);
        if (!Number.isFinite(ts)) continue;
        if (ts < cutoff) {
          reachedOld = true;
          continue;
        }
        if (a.status !== "paid" && a.status !== "partial_refund") continue;
        const net = (toInt(a.total) ?? 0) - (toInt(a.refunded_amount) ?? 0);
        if (net > 0) payments.push({ tsMs: ts, minor: net, currency: String(a.currency || "USD").toUpperCase() });
      }
      if (reachedOld || page >= (res?.meta?.page?.lastPage ?? 1)) break;
    }

    return {
      activeSubscriptions: active,
      mrr,
      payments,
      method: "Active Lemon Squeezy subscriptions × price × quantity, normalised by renewal interval. Revenue = paid orders minus refunds, last 12 months.",
      warnings: [],
    };
  },
};
