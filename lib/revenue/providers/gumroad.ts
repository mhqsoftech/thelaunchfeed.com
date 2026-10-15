import { requestJson } from "../http";
import { CredentialError, expectArray, toInt, TWELVE_MONTHS_MS, type Payment, type ProviderAdapter } from "../types";

/**
 * Gumroad — application access token. Gumroad has no subscription-price
 * endpoint, so MRR is reported honestly as the trailing-30-day sum of
 * recurring (membership) charges, refunds and chargebacks excluded.
 */
const API = "https://api.gumroad.com/v2";
const MAX_PAGES = 30;

export const gumroad: ProviderAdapter = {
  id: "gumroad",
  validateCredential(raw) {
    if (!/^[A-Za-z0-9_-]{20,}$/.test(raw.trim())) throw new CredentialError("Paste your Gumroad application access token (Settings → Advanced → Applications).");
  },
  async fetchSnapshot(token) {
    const after = new Date(Date.now() - TWELVE_MONTHS_MS).toISOString().slice(0, 10);
    const payments: Payment[] = [];
    const recurring30: Payment[] = [];
    const subs = new Set<string>();
    const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;

    let pageKey: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      // Token in the query is how Gumroad's v2 API authenticates; it is never logged.
      const q = new URLSearchParams({ access_token: token.trim(), after });
      if (pageKey) q.set("page_key", pageKey);
      const res = await requestJson<any>("Gumroad", `${API}/sales?${q}`, {}, { what: "sales" });
      if (res?.success === false) throw new CredentialError("Gumroad rejected the access token.");
      for (const s of expectArray<any>(res?.sales, "sales", "Gumroad")) {
        if (s.refunded || s.chargedback || s.partially_refunded) continue;
        const ts = Date.parse(s.created_at);
        const amt = toInt(s.price);
        if (!amt || amt <= 0 || !Number.isFinite(ts)) continue;
        const p = { tsMs: ts, minor: amt, currency: String(s.currency || "USD").toUpperCase() };
        payments.push(p);
        if (s.subscription_id && ts >= cutoff30) {
          recurring30.push(p);
          subs.add(String(s.subscription_id));
        }
      }
      pageKey = res?.next_page_key;
      if (!pageKey) break;
    }

    return {
      activeSubscriptions: subs.size,
      mrr: recurring30.map((p) => ({ minor: p.minor, currency: p.currency })),
      payments,
      method: "Gumroad has no subscription-price API, so MRR = recurring membership charges collected in the last 30 days. Revenue = non-refunded sales, last 12 months.",
      warnings: ["Gumroad MRR is a trailing-30-day figure; annual memberships appear only in the month they renew."],
    };
  },
};
