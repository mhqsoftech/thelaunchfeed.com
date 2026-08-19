import { promises as dns } from "dns";
import { isIP } from "net";

/**
 * Validate that a URL is safe to fetch server-side.
 *
 * Rejects: non-http(s) schemes, IP literals in private / reserved ranges, and
 * hostnames that resolve to any such IP (cloud metadata endpoints, loopback,
 * link-local, RFC1918 space, ULA, unique local, etc.).
 *
 * Callers should also disable transparent redirect-following (redirect:
 * "manual") and re-validate the Location target on each hop, otherwise an
 * attacker-controlled origin can 302 into an internal address.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true; // loopback
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + AWS/GCP metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true; // 192.0.0.0/24
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped
    const v4 = lower.slice(7);
    if (isIP(v4) === 4) return isPrivateIPv4(v4);
  }
  return false;
}

function isPrivateIP(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true;
}

export type SsrfCheckResult = { ok: true; url: URL } | { ok: false; reason: string };

export async function assertSafeUrl(raw: string): Promise<SsrfCheckResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "invalid protocol" };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return { ok: false, reason: "blocked hostname" };
  }

  // IP literal in the URL — validate directly.
  if (isIP(host)) {
    if (isPrivateIP(host)) return { ok: false, reason: "private ip literal" };
    return { ok: true, url };
  }

  // Hostname — resolve and ensure every A/AAAA record is public.
  try {
    const addrs = await dns.lookup(host, { all: true });
    if (addrs.length === 0) return { ok: false, reason: "unresolvable host" };
    for (const a of addrs) {
      if (isPrivateIP(a.address)) return { ok: false, reason: "resolves to private ip" };
    }
  } catch {
    return { ok: false, reason: "dns lookup failed" };
  }

  return { ok: true, url };
}

/**
 * Fetch a URL with manual redirect-following that re-runs the SSRF check on
 * every hop. Use this in place of `fetch(url, { redirect: "follow" })` for any
 * user-supplied URL.
 */
export async function safeFetch(
  raw: string,
  init: RequestInit & { timeoutMs?: number; maxRedirects?: number } = {}
): Promise<Response> {
  const { timeoutMs = 10_000, maxRedirects = 3, ...rest } = init;
  let currentUrl = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await assertSafeUrl(currentUrl);
    if (!check.ok) throw new Error(`ssrf: ${check.reason}`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(check.url.toString(), {
        ...rest,
        redirect: "manual",
        signal: ctrl.signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return res;
        currentUrl = new URL(loc, check.url).toString();
        continue;
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("ssrf: too many redirects");
}
