import { basicAuth, requestJson } from "../http";
import { CredentialError, expectArray, monthlyFactor, toInt, type Minor, type ProviderAdapter } from "../types";

/**
 * FastSpring — API credentials "username:password" (Basic auth).
 * Subscription IDs are listed, then fetched in batches for price, currency,
 * interval and the `live` flag (test subscriptions are rejected).
 */
const API = "https://api.fastspring.com";
const MAX_PAGES = 20;

export const fastspring: ProviderAdapter = {
  id: "fastspring",
  validateCredential(raw) {
    const [u, p] = raw.trim().split(":");
    if (!u || !p) throw new CredentialError("FastSpring needs API credentials: paste as username:password.");
  },
  async fetchSnapshot(raw) {
    const [u, p] = raw.trim().split(":");
    const headers = { Authorization: basicAuth(u, p) };
    const ids: string[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await requestJson<any>("FastSpring", `${API}/subscriptions?status=active&limit=50&page=${page}`, { headers }, { what: "subscriptions" });
      const batch = expectArray<string>(res?.subscriptions, "subscriptions", "FastSpring");
      ids.push(...batch.map(String));
      if (!res?.nextPage) break;
    }

    const mrr: Minor[] = [];
    let active = 0;
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50).map(encodeURIComponent).join(",");
      const res = await requestJson<any>("FastSpring", `${API}/subscriptions/${chunk}`, { headers }, { what: "subscription details" });
      for (const s of expectArray<any>(res?.subscriptions, "subscription details", "FastSpring")) {
        if (s.live === false) throw new CredentialError("FastSpring returned test subscriptions. Use live-store credentials.");
        if (!s.active && s.state !== "active") continue;
        active++;
        const factor = monthlyFactor(s.intervalUnit, s.intervalLength ?? 1);
        const price = typeof s.price === "number" ? s.price : Number(s.price);
        if (factor === null || !Number.isFinite(price)) continue;
        // FastSpring prices are in major units (e.g. 19.99).
        mrr.push({ minor: Math.round(price * 100) * (toInt(s.quantity) ?? 1) * factor, currency: String(s.currency || "USD").toUpperCase() });
      }
    }

    return {
      activeSubscriptions: active,
      mrr,
      payments: [],
      method: "Active live FastSpring subscriptions × price × quantity, normalised by interval.",
      warnings: ["FastSpring order history isn't read, so the revenue chart isn't available for this provider."],
    };
  },
};
