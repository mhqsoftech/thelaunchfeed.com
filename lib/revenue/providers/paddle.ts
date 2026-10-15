import { requestJson } from "../http";
import { CredentialError, expectArray, monthlyFactor, toInt, TWELVE_MONTHS_MS, type Minor, type Payment, type ProviderAdapter } from "../types";

/**
 * Paddle Billing — API key (pdl_live_apikey_…). Sandbox keys rejected.
 * Paddle amounts are strings in the currency's LOWEST denomination already
 * (the previous implementation multiplied them by 100 — a 100× overstatement).
 */
const API = "https://api.paddle.com";
const MAX_PAGES = 20;

export const paddle: ProviderAdapter = {
  id: "paddle",
  validateCredential(raw) {
    const k = raw.trim();
    if (/_sdbx_/.test(k)) throw new CredentialError("That's a Paddle SANDBOX key. Use a live API key (pdl_live_apikey_…).");
    if (k.length < 20) throw new CredentialError("Paddle API keys look like pdl_live_apikey_….");
  },
  async fetchSnapshot(key) {
    const headers = { Authorization: `Bearer ${key.trim()}` };
    const mrr: Minor[] = [];
    let active = 0;

    let url: string | null = `${API}/subscriptions?status=active&per_page=200`;
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const res: any = await requestJson<any>("Paddle", url, { headers }, { what: "subscriptions" });
      const subs = expectArray<any>(res?.data, "subscriptions", "Paddle");
      for (const sub of subs) {
        active++;
        const currency = String(sub.currency_code || "").toUpperCase();
        for (const item of sub.items ?? []) {
          const amount = toInt(item.price?.unit_price?.amount);
          const factor = monthlyFactor(item.price?.billing_cycle?.interval ?? sub.billing_cycle?.interval, item.price?.billing_cycle?.frequency ?? sub.billing_cycle?.frequency ?? 1);
          if (amount === null || factor === null || !currency) continue;
          mrr.push({ minor: amount * (item.quantity ?? 1) * factor, currency });
        }
      }
      url = res?.meta?.pagination?.has_more ? res.meta.pagination.next : null;
    }

    const payments: Payment[] = [];
    const since = new Date(Date.now() - TWELVE_MONTHS_MS).toISOString();
    url = `${API}/transactions?status=completed&per_page=200&created_at[GTE]=${encodeURIComponent(since)}`;
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const res: any = await requestJson<any>("Paddle", url, { headers }, { what: "transactions" });
      const txs = expectArray<any>(res?.data, "transactions", "Paddle");
      for (const t of txs) {
        const total = toInt(t.details?.totals?.grand_total ?? t.details?.totals?.total);
        const currency = String(t.currency_code || "").toUpperCase();
        const ts = Date.parse(t.billed_at || t.created_at);
        if (total && total > 0 && currency && Number.isFinite(ts)) payments.push({ tsMs: ts, minor: total, currency });
      }
      url = res?.meta?.pagination?.has_more ? res.meta.pagination.next : null;
    }

    return {
      activeSubscriptions: active,
      mrr,
      payments,
      method: "Active Paddle subscriptions × unit price × quantity, normalised by billing cycle. Revenue = completed transactions, last 12 months (refund adjustments not subtracted).",
      warnings: [],
    };
  },
};
