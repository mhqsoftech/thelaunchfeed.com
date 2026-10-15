import { requestJson } from "../http";
import { CredentialError, ProviderUnavailableError, expectArray, type ProviderAdapter } from "../types";

/**
 * RevenueCat — v2 secret API key (sk_…) with read access to project metrics.
 * Uses RevenueCat's own production metrics overview: MRR and revenue over the
 * last 28 days (both reported in USD). Sandbox purchases are excluded by RC.
 */
const API = "https://api.revenuecat.com/v2";

export const revenuecat: ProviderAdapter = {
  id: "revenuecat",
  validateCredential(raw) {
    const k = raw.trim();
    if (/^(appl|goog|amzn|strp|rcb)_/.test(k)) throw new CredentialError("That's a public SDK key. Create a v2 SECRET key (sk_…) with read access to metrics.");
    if (!k.startsWith("sk_")) throw new CredentialError("RevenueCat v2 secret keys look like sk_….");
  },
  async fetchSnapshot(key) {
    const headers = { Authorization: `Bearer ${key.trim()}` };
    const projects = expectArray<any>((await requestJson<any>("RevenueCat", `${API}/projects`, { headers }, { what: "projects" }))?.items, "projects", "RevenueCat");
    if (projects.length === 0) throw new ProviderUnavailableError("This RevenueCat key has no projects.");

    let mrrUsd = 0;
    let revenue28Usd = 0;
    let activeSubs = 0;
    let found = false;
    for (const proj of projects.slice(0, 10)) {
      const ov = await requestJson<any>("RevenueCat", `${API}/projects/${encodeURIComponent(proj.id)}/metrics/overview`, { headers }, { what: "metrics" });
      const metrics = expectArray<any>(ov?.metrics, "metrics", "RevenueCat");
      const get = (id: string) => metrics.find((m) => m.id === id)?.value;
      const mrr = get("mrr");
      if (typeof mrr === "number") {
        found = true;
        mrrUsd += mrr;
      }
      if (typeof get("revenue") === "number") revenue28Usd += get("revenue");
      if (typeof get("active_subscriptions") === "number") activeSubs += get("active_subscriptions");
    }
    if (!found) throw new ProviderUnavailableError("RevenueCat didn't return an MRR metric for this key.");

    return {
      activeSubscriptions: activeSubs,
      mrr: [{ minor: Math.round(mrrUsd * 100), currency: "USD" }],
      payments: [],
      trailingRevenue: { minor: Math.round(revenue28Usd * 100), currency: "USD", days: 28 },
      method: "RevenueCat's production MRR metric (all projects on the key). Revenue = RevenueCat's last-28-days revenue metric.",
      warnings: ["RevenueCat exposes aggregate metrics only, so the monthly chart isn't available."],
    };
  },
};
