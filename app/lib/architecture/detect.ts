import { detectFromHtml, fingerprintSummary, type TechFingerprint } from "../autofill/fingerprint";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic (non-AI) architecture & technical-specs detector.
//
// Probes the target site for observable signals — HTTP headers, TLS/HSTS,
// CSP, security.txt, robots.txt, sitemap, PWA manifest, API surfaces
// (/api, /graphql, /openapi.json, /swagger.json), health endpoints, and
// framework/CDN/analytics/payments fingerprints from the HTML — and returns a
// structured verdict suitable for submitting into the Architecture &
// Technical Specs form section.
// ─────────────────────────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (compatible; TheLaunchFeed-ArchitectureProbe/1.0; +https://thelaunchfeed.com/bots)";

const PROBE_TIMEOUT_MS = 5000;
const TOTAL_BUDGET_MS = 24_000;

export type TechnicalArchitecture = {
  origin: string;
  https: boolean;
  hsts: boolean;
  csp: boolean;
  xFrameOptions: string;
  xContentTypeOptions: string;
  referrerPolicy: string;
  permissionsPolicy: boolean;
  server: string;
  poweredBy: string;
  metaGenerator: string;
  fingerprint: TechFingerprint;
  cdn: string; // detected CDN name (Cloudflare / Vercel / …)
  hostingProvider: string; // detected hosting inferred from headers + fingerprint
  cookies: string[]; // cookie names on the root response (for signal only)
  robots: { present: boolean; disallowsAll: boolean };
  sitemap: { present: boolean; url: string };
  securityTxt: { present: boolean; url: string; contact: string };
  humansTxt: { present: boolean };
  manifest: { present: boolean; name: string };
  feeds: { rss: boolean; atom: boolean; jsonFeed: boolean };
  apiSurfaces: {
    apiRoot: string; // e.g. https://example.com/api
    graphql: string;
    openapi: string;
    swagger: string;
    docs: string;
    health: string;
  };
  // ────── final, form-ready output ──────
  form: {
    techStack: string;
    infraHosting: string;
    apiUrl: string;
    securityStandards: string;
  };
  meta: {
    signals: number;
    probedUrls: string[];
    durationMs: number;
  };
};

function abortableFetch(url: string, timeout = PROBE_TIMEOUT_MS): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  return fetch(url, {
    method: "GET",
    signal: ac.signal,
    redirect: "follow",
    headers: { "user-agent": UA, accept: "*/*" },
  }).finally(() => clearTimeout(t));
}

function headHead(url: string, timeout = PROBE_TIMEOUT_MS): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  return fetch(url, {
    method: "HEAD",
    signal: ac.signal,
    redirect: "follow",
    headers: { "user-agent": UA },
  }).finally(() => clearTimeout(t));
}

function headersAsMap(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => (out[k.toLowerCase()] = v));
  return out;
}

function detectCdn(h: Record<string, string>): string {
  const v = (name: string) => h[name] || "";
  if (v("cf-ray") || v("server").toLowerCase().includes("cloudflare")) return "Cloudflare";
  if (v("x-vercel-id") || v("server").toLowerCase().includes("vercel")) return "Vercel Edge Network";
  if (v("x-nf-request-id") || v("server").toLowerCase().includes("netlify")) return "Netlify Edge";
  if (v("x-served-by")?.includes("cache-") && v("via")?.includes("varnish")) return "Fastly";
  if (v("x-amz-cf-id")) return "AWS CloudFront";
  if (v("x-akamai-transformed") || v("x-akamai-request-id")) return "Akamai";
  if (v("x-fly-request-id") || v("fly-request-id")) return "Fly.io";
  if (v("x-render-origin-server")) return "Render";
  if (v("x-envoy-upstream-service-time") && v("server").toLowerCase().includes("google")) return "Google Frontend";
  if (v("x-github-request-id")) return "GitHub Pages";
  return "";
}

function detectHostingFromHeaders(h: Record<string, string>): string {
  const cdn = detectCdn(h);
  if (cdn) return cdn;
  const s = (h["server"] || "").toLowerCase();
  if (s.includes("gws")) return "Google Frontend";
  if (s.includes("amazons3")) return "Amazon S3";
  if (s.includes("nginx")) return "nginx (self-hosted)";
  if (s.includes("apache")) return "Apache (self-hosted)";
  return "";
}

function firstLine(str: string, max = 240): string {
  return (str || "").split(/\r?\n/, 1)[0]?.slice(0, max) ?? "";
}

async function probe(originUrl: URL, path: string): Promise<{ ok: boolean; status: number; text?: string; headers?: Record<string, string> }> {
  const url = new URL(path, originUrl).toString();
  try {
    const res = await abortableFetch(url);
    if (!res.ok) return { ok: false, status: res.status };
    const ct = res.headers.get("content-type") || "";
    const text = /json|xml|text|javascript|html/i.test(ct) ? await res.text().catch(() => "") : "";
    return { ok: true, status: res.status, text, headers: headersAsMap(res.headers) };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function probeHead(originUrl: URL, path: string): Promise<boolean> {
  const url = new URL(path, originUrl).toString();
  try {
    const res = await headHead(url);
    return res.ok;
  } catch {
    return false;
  }
}

export async function analyzeArchitecture(inputUrl: string): Promise<TechnicalArchitecture> {
  const started = Date.now();
  const url = /^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`;
  const originUrl = new URL(url);
  const origin = originUrl.origin;

  // 1) Root fetch — headers + html for fingerprint
  const rootRes = await abortableFetch(origin, PROBE_TIMEOUT_MS + 3000);
  const rootHeaders = headersAsMap(rootRes.headers);
  const rootHtml = await rootRes.text().catch(() => "");

  // 2) Deterministic tech fingerprint from HTML + response headers
  const fingerprint = detectFromHtml(rootHtml, rootHeaders);

  // 3) Cookies (names only, values are irrelevant)
  const setCookie = rootRes.headers.get("set-cookie") || "";
  const cookies = Array.from(
    new Set(
      setCookie
        .split(/,(?=[^;]+=[^;]+)/g)
        .map((c) => c.split("=")[0]?.trim())
        .filter(Boolean) as string[],
    ),
  );

  // 4) CDN + hosting inference from headers
  const cdn = detectCdn(rootHeaders);
  const hostingProvider =
    fingerprint.hosting[0] || detectHostingFromHeaders(rootHeaders) || cdn || "";

  // 5) Parallel probes with global time budget
  const probes = await Promise.allSettled([
    probe(originUrl, "/robots.txt"),
    probe(originUrl, "/sitemap.xml"),
    probe(originUrl, "/.well-known/security.txt"),
    probe(originUrl, "/humans.txt"),
    probe(originUrl, "/manifest.json"),
    probe(originUrl, "/site.webmanifest"),
    probe(originUrl, "/openapi.json"),
    probe(originUrl, "/openapi.yaml"),
    probe(originUrl, "/swagger.json"),
    probe(originUrl, "/graphql"),
    probeHead(originUrl, "/api"),
    probeHead(originUrl, "/api/"),
    probeHead(originUrl, "/api/v1"),
    probeHead(originUrl, "/docs"),
    probeHead(originUrl, "/api/docs"),
    probeHead(originUrl, "/developers"),
    probeHead(originUrl, "/health"),
    probeHead(originUrl, "/healthz"),
    probeHead(originUrl, "/status"),
    probe(originUrl, "/feed"),
    probe(originUrl, "/rss.xml"),
    probe(originUrl, "/atom.xml"),
    probe(originUrl, "/feed.json"),
  ]);

  const val = <T,>(i: number): T | null => (probes[i]?.status === "fulfilled" ? (probes[i] as PromiseFulfilledResult<T>).value : null);

  const robotsRes = val<{ ok: boolean; text?: string }>(0);
  const sitemapRes = val<{ ok: boolean }>(1);
  const secRes = val<{ ok: boolean; text?: string }>(2);
  const humansRes = val<{ ok: boolean }>(3);
  const manifest1 = val<{ ok: boolean; text?: string }>(4);
  const manifest2 = val<{ ok: boolean; text?: string }>(5);
  const openapi = val<{ ok: boolean }>(6) ?? val<{ ok: boolean }>(7);
  const swagger = val<{ ok: boolean }>(8);
  const graphql = val<{ ok: boolean; text?: string; status?: number }>(9);
  const apiRootHits: (boolean | null)[] = [val<boolean>(10), val<boolean>(11), val<boolean>(12)];
  const docsHit = val<boolean>(13) || val<boolean>(14) || val<boolean>(15);
  const healthHit = val<boolean>(16) || val<boolean>(17) || val<boolean>(18);
  const feedRss = val<{ ok: boolean }>(19) ?? null;
  const feedRss2 = val<{ ok: boolean }>(20) ?? null;
  const feedAtom = val<{ ok: boolean }>(21) ?? null;
  const feedJson = val<{ ok: boolean }>(22) ?? null;

  // 6) Aggregate detections
  const robots = {
    present: !!robotsRes?.ok,
    disallowsAll: /User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*$/mi.test(robotsRes?.text || ""),
  };
  const sitemap = { present: !!sitemapRes?.ok, url: sitemap_url(!!sitemapRes?.ok, originUrl) };
  const securityTxt = {
    present: !!secRes?.ok,
    url: secRes?.ok ? new URL("/.well-known/security.txt", originUrl).toString() : "",
    contact: extractSecTxtField(secRes?.text || "", "Contact"),
  };
  const humansTxt = { present: !!humansRes?.ok };
  const manifest = extractManifest(manifest1, manifest2);
  const feeds = {
    rss: !!feedRss?.ok || !!feedRss2?.ok,
    atom: !!feedAtom?.ok,
    jsonFeed: !!feedJson?.ok,
  };

  const apiSurfaces = {
    apiRoot: apiRootHits.some(Boolean) ? new URL("/api", originUrl).toString() : "",
    graphql: graphql?.ok ? new URL("/graphql", originUrl).toString() : "",
    openapi: openapi?.ok ? new URL("/openapi.json", originUrl).toString() : "",
    swagger: swagger?.ok ? new URL("/swagger.json", originUrl).toString() : "",
    docs: docsHit ? new URL("/docs", originUrl).toString() : "",
    health: healthHit ? new URL("/health", originUrl).toString() : "",
  };

  // 7) Security posture
  const hsts = !!rootHeaders["strict-transport-security"];
  const csp = !!(rootHeaders["content-security-policy"] || rootHeaders["content-security-policy-report-only"]);
  const xFrameOptions = firstLine(rootHeaders["x-frame-options"] || "");
  const xContentTypeOptions = firstLine(rootHeaders["x-content-type-options"] || "");
  const referrerPolicy = firstLine(rootHeaders["referrer-policy"] || "");
  const permissionsPolicy = !!(rootHeaders["permissions-policy"] || rootHeaders["feature-policy"]);
  const https = originUrl.protocol === "https:";

  // 8) Form-ready outputs
  const stackParts = [
    ...(fingerprint.languages || []),
    ...(fingerprint.frameworks || []),
    ...(fingerprint.libraries || []).slice(0, 4),
    ...(fingerprint.cms || []),
    ...(fingerprint.analytics || []).slice(0, 2),
    ...(fingerprint.payments || []).slice(0, 2),
    ...(fingerprint.auth || []).slice(0, 2),
    ...(fingerprint.errorTracking || []).slice(0, 2),
    ...(fingerprint.observability || []).slice(0, 2),
  ];
  const techStack = Array.from(new Set(stackParts.filter(Boolean))).join(", ");

  const infraParts = [
    ...(fingerprint.hosting || []),
    ...(fingerprint.cdn || []),
    cdn,
  ];
  const infraHosting = Array.from(new Set(infraParts.filter(Boolean))).join(", ");

  const apiUrl =
    apiSurfaces.openapi ||
    apiSurfaces.swagger ||
    apiSurfaces.graphql ||
    apiSurfaces.apiRoot ||
    apiSurfaces.docs ||
    "";

  const securityStandards = buildSecurityDescription({
    https,
    hsts,
    csp,
    xFrameOptions,
    xContentTypeOptions,
    referrerPolicy,
    permissionsPolicy,
    securityTxtPresent: securityTxt.present,
    securityContact: securityTxt.contact,
  });

  const probedUrls: string[] = [
    "/robots.txt",
    "/sitemap.xml",
    "/.well-known/security.txt",
    "/humans.txt",
    "/manifest.json",
    "/openapi.json",
    "/swagger.json",
    "/graphql",
    "/api",
    "/docs",
    "/health",
    "/feed",
    "/rss.xml",
    "/atom.xml",
  ];
  const signals =
    Object.values(fingerprint).flat().filter(Boolean).length +
    (robots.present ? 1 : 0) +
    (sitemap.present ? 1 : 0) +
    (securityTxt.present ? 1 : 0) +
    (manifest.present ? 1 : 0) +
    (feeds.rss ? 1 : 0) +
    (feeds.atom ? 1 : 0) +
    (feeds.jsonFeed ? 1 : 0) +
    Object.values(apiSurfaces).filter(Boolean).length +
    (hsts ? 1 : 0) +
    (csp ? 1 : 0) +
    (xFrameOptions ? 1 : 0) +
    (referrerPolicy ? 1 : 0);

  // safety: bail out if we've somehow blown the budget
  const durationMs = Date.now() - started;
  if (durationMs > TOTAL_BUDGET_MS) {
    // continue anyway — result is still valid
  }

  return {
    origin,
    https,
    hsts,
    csp,
    xFrameOptions,
    xContentTypeOptions,
    referrerPolicy,
    permissionsPolicy,
    server: rootHeaders["server"] || "",
    poweredBy: rootHeaders["x-powered-by"] || "",
    metaGenerator: fingerprint.metaGenerator || "",
    fingerprint,
    cdn,
    hostingProvider,
    cookies,
    robots,
    sitemap,
    securityTxt,
    humansTxt,
    manifest,
    feeds,
    apiSurfaces,
    form: { techStack, infraHosting, apiUrl, securityStandards },
    meta: { signals, probedUrls, durationMs },
  };
}

function sitemap_url(present: boolean, originUrl: URL): string {
  return present ? new URL("/sitemap.xml", originUrl).toString() : "";
}

function extractSecTxtField(text: string, field: string): string {
  if (!text) return "";
  const re = new RegExp(`^${field}:\\s*(.+)$`, "im");
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

function extractManifest(
  m1: { ok: boolean; text?: string } | null,
  m2: { ok: boolean; text?: string } | null,
): { present: boolean; name: string } {
  const src = (m1?.ok && m1) || (m2?.ok && m2) || null;
  if (!src) return { present: false, name: "" };
  try {
    const parsed = JSON.parse(src.text || "{}");
    return { present: true, name: parsed?.name || parsed?.short_name || "" };
  } catch {
    return { present: true, name: "" };
  }
}

function buildSecurityDescription(sig: {
  https: boolean;
  hsts: boolean;
  csp: boolean;
  xFrameOptions: string;
  xContentTypeOptions: string;
  referrerPolicy: string;
  permissionsPolicy: boolean;
  securityTxtPresent: boolean;
  securityContact: string;
}): string {
  const parts: string[] = [];
  if (sig.https) parts.push("HTTPS/TLS transport encryption");
  if (sig.hsts) parts.push("HSTS (Strict-Transport-Security)");
  if (sig.csp) parts.push("Content-Security-Policy");
  if (sig.xFrameOptions) parts.push(`X-Frame-Options: ${sig.xFrameOptions}`);
  if (sig.xContentTypeOptions) parts.push(`X-Content-Type-Options: ${sig.xContentTypeOptions}`);
  if (sig.referrerPolicy) parts.push(`Referrer-Policy: ${sig.referrerPolicy}`);
  if (sig.permissionsPolicy) parts.push("Permissions-Policy");
  if (sig.securityTxtPresent) {
    parts.push(
      sig.securityContact
        ? `Published /.well-known/security.txt (contact: ${sig.securityContact})`
        : "Published /.well-known/security.txt",
    );
  }
  if (!parts.length) return "";
  return parts.join(" · ");
}

export function fingerprintFlat(fp: TechFingerprint): string {
  return fingerprintSummary(fp);
}
