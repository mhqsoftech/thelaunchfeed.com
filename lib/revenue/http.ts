import { CredentialError, ProviderUnavailableError } from "./types";

/**
 * JSON request with timeout, bounded retries (429 / 5xx / network) and
 * error mapping. Credentials never appear in thrown messages or logs.
 */
export async function requestJson<T = any>(
  provider: string,
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; timeoutMs?: number; what?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const what = opts.what ?? "data";
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { Accept: "application/json", "User-Agent": "TheLaunchFeed-RevenueVerifier/2.0", ...(init.headers || {}) },
        signal: ctrl.signal,
        cache: "no-store",
        redirect: "error",
      });
      if (res.ok) {
        try {
          return (await res.json()) as T;
        } catch {
          throw new ProviderUnavailableError(`${provider} returned an unreadable response for ${what}.`);
        }
      }
      if (res.status === 401) {
        throw new CredentialError(`${provider} rejected the credentials (401). Check that the key is correct, live-mode and not revoked.`);
      }
      if (res.status === 403) {
        throw new CredentialError(`${provider} denied access to ${what} (403). Give the key read access to ${what}.`);
      }
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        lastErr = new ProviderUnavailableError(`${provider} is unavailable right now (HTTP ${res.status}). Try again shortly.`);
        if (attempt < retries) {
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 800 * 2 ** attempt;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw lastErr;
      }
      // Other 4xx: our request is wrong for this account (e.g. missing feature).
      throw new ProviderUnavailableError(`${provider} refused the ${what} request (HTTP ${res.status}).`);
    } catch (err) {
      if (err instanceof CredentialError || err instanceof ProviderUnavailableError) {
        if (err instanceof ProviderUnavailableError && attempt < retries && /unavailable/.test(err.message)) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
        continue;
      }
      throw new ProviderUnavailableError(`Could not reach ${provider} (${err instanceof Error && err.name === "AbortError" ? "timeout" : "network error"}).`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new ProviderUnavailableError(`Could not reach ${provider}.`);
}

export function basicAuth(user: string, pass = "") {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}
