const USER_AGENT =
  "TheLaunchFeedBot/1.0 (+https://thelaunchfeed.com/bot; contact=hi@thelaunchfeed.com)";

const FETCH_TIMEOUT_MS = 6000;
const MAX_PAGES = 24;
const MAX_HTML_BYTES = 750_000;

const CANDIDATE_PATHS = [
  // Home / brand
  "/",
  "/home",
  "/index",
  "/start",
  "/welcome",

  // About / company / team
  "/about",
  "/about-us",
  "/company",
  "/team",
  "/people",
  "/mission",
  "/manifesto",
  "/story",
  "/who-we-are",

  // Product / features
  "/product",
  "/products",
  "/features",
  "/how-it-works",
  "/platform",
  "/solutions",
  "/use-cases",
  "/customers",
  "/case-studies",
  "/showcase",
  "/demo",
  "/tour",
  "/overview",

  // Pricing / plans / billing
  "/pricing",
  "/plans",
  "/plan",
  "/subscribe",
  "/billing",
  "/buy",
  "/upgrade",

  // Docs / API / integrations
  "/docs",
  "/documentation",
  "/api",
  "/api-docs",
  "/developers",
  "/developer",
  "/integrations",
  "/sdk",
  "/reference",

  // Support / help
  "/faq",
  "/faqs",
  "/help",
  "/support",
  "/contact",
  "/contact-us",

  // Changelog / roadmap / releases
  "/changelog",
  "/changes",
  "/release-notes",
  "/releases",
  "/whats-new",
  "/updates",
  "/roadmap",

  // Legal / trust
  "/security",
  "/trust",
  "/privacy",
  "/terms",

  // Blog / press
  "/blog",
  "/press",
  "/news",

  // Careers
  "/careers",
  "/jobs",
];

export type CrawledPage = {
  url: string;
  title: string;
  description: string;
  text: string;
  ogImage?: string;
  favicon?: string;
  appleTouchIcon?: string;
  socials: string[];
  emails: string[];
  html?: string;
  headers?: Record<string, string>;
  anchorSections: Record<string, string>;
};

export type CrawlResult = {
  origin: string;
  pages: CrawledPage[];
  primary: CrawledPage | null;
  robotsAllowed: boolean;
};

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithHeaders(
  url: string,
  cap = MAX_HTML_BYTES,
): Promise<{ text: string; headers: Record<string, string> } | null> {
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return null;
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text().catch(() => "");
    return { text, headers };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total >= cap) {
        try {
          await reader.cancel();
        } catch {}
        break;
      }
    }
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c.subarray(0, Math.min(c.byteLength, cap - off)), off);
    off += c.byteLength;
    if (off >= cap) break;
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  return { text, headers };
}

async function fetchText(url: string, cap = MAX_HTML_BYTES): Promise<string | null> {
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return null;
  const reader = res.body?.getReader();
  if (!reader) return await res.text().catch(() => null);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total >= cap) {
        try {
          await reader.cancel();
        } catch {}
        break;
      }
    }
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c.subarray(0, Math.min(c.byteLength, cap - off)), off);
    off += c.byteLength;
    if (off >= cap) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

async function isAllowedByRobots(origin: string): Promise<boolean> {
  const txt = await fetchText(`${origin}/robots.txt`, 50_000);
  if (!txt) return true;
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  let applies = false;
  let disallowRoot = false;
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const [rawK, ...rest] = line.split(":");
    if (!rest.length) continue;
    const k = rawK.toLowerCase().trim();
    const v = rest.join(":").trim();
    if (k === "user-agent") applies = v === "*" || v.toLowerCase().includes("launchfeed");
    else if (applies && k === "disallow" && (v === "/" || v === "")) disallowRoot = v === "/";
  }
  return !disallowRoot;
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  return m?.[1] ?? m?.[2] ?? m?.[3];
}

function extractMeta(html: string): {
  title: string;
  description: string;
  ogImage?: string;
  favicon?: string;
  appleTouchIcon?: string;
} {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]).slice(0, 300) : "";

  let description = "";
  let ogImage: string | undefined;
  let favicon: string | undefined;
  let appleTouchIcon: string | undefined;
  let largestIconSize = 0;

  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const name = (attr(tag, "name") || attr(tag, "property") || "").toLowerCase();
    const content = attr(tag, "content");
    if (!content) continue;
    if (!description && (name === "description" || name === "og:description" || name === "twitter:description")) {
      description = stripTags(content).slice(0, 500);
    }
    if (!ogImage && (name === "og:image" || name === "og:image:url" || name === "og:image:secure_url" || name === "twitter:image" || name === "twitter:image:src")) {
      ogImage = content;
    }
  }

  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const rel = (attr(tag, "rel") || "").toLowerCase();
    const href = attr(tag, "href");
    if (!href) continue;
    if (rel.includes("apple-touch-icon")) {
      appleTouchIcon = href;
      continue;
    }
    if (rel.includes("icon") || rel.includes("mask-icon") || rel.includes("shortcut")) {
      // Prefer the largest declared icon size.
      const sizes = attr(tag, "sizes") ?? "";
      const sizeMatch = sizes.match(/(\d+)/);
      const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 16;
      if (size >= largestIconSize) {
        largestIconSize = size;
        favicon = href;
      }
    }
  }

  return { title, description, ogImage, favicon, appleTouchIcon };
}

function extractSocials(html: string): string[] {
  const hrefs = new Set<string>();
  const re = /href\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  let m: RegExpExecArray | null;
  const patterns = [
    /twitter\.com\/[A-Za-z0-9_]+/i,
    /x\.com\/[A-Za-z0-9_]+/i,
    /github\.com\/[A-Za-z0-9_.-]+/i,
    /linkedin\.com\/(?:in|company)\/[A-Za-z0-9_.-]+/i,
    /(?:youtube\.com|youtu\.be)\/[A-Za-z0-9_.@/-]+/i,
    /discord\.(?:gg|com\/invite)\/[A-Za-z0-9_-]+/i,
    /producthunt\.com\/(?:products|posts)\/[A-Za-z0-9_-]+/i,
  ];
  while ((m = re.exec(html))) {
    const href = m[1] || m[2];
    for (const p of patterns) if (p.test(href)) hrefs.add(href.split("?")[0]);
  }
  return Array.from(hrefs).slice(0, 30);
}

function absolutize(base: string, href?: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

// Anchor ids that commonly hold pricing/plan copy on single-page sites.
const ANCHOR_IDS = ["pricing", "plans", "prices", "price", "tiers", "buy", "features", "faq", "faqs"];

function extractAnchorSections(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of ANCHOR_IDS) {
    // Match <section|div|article|main id="pricing"> ... </same-tag>. Non-greedy, best-effort.
    const re = new RegExp(
      `<(section|div|article|main)\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
      "i",
    );
    const m = html.match(re);
    if (m && m[2]) {
      const text = stripTags(m[2]).trim();
      if (text.length > 40) out[id] = text.slice(0, 8000);
    }
  }
  return out;
}

function isValidEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 100) return false;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return false;
  if (/sentry\.io|w3\.org|schema\.org|example\.com|domain\.com|png$|jpg$|svg$|gif$/i.test(email)) return false;
  return true;
}

function extractEmails(html: string): string[] {
  const emails = new Set<string>();

  // 1. Extract from mailto: links
  const mailtoMatches = html.matchAll(/href\s*=\s*["']mailto:([^"?#\s>]+)["']/gi);
  for (const m of mailtoMatches) {
    if (m[1]) {
      const email = m[1].trim().toLowerCase();
      if (isValidEmail(email)) emails.add(email);
    }
  }

  // 2. Extract from raw email patterns in HTML text/content
  const rawMatches = html.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g);
  for (const m of rawMatches) {
    const email = m[0].trim().toLowerCase();
    if (isValidEmail(email)) emails.add(email);
  }

  return Array.from(emails).slice(0, 15);
}

function parsePage(url: string, html: string): CrawledPage {
  const meta = extractMeta(html);
  const text = stripTags(html).slice(0, 12_000);
  return {
    url,
    title: meta.title,
    description: meta.description,
    text,
    ogImage: absolutize(url, meta.ogImage),
    favicon: absolutize(url, meta.favicon),
    appleTouchIcon: absolutize(url, meta.appleTouchIcon),
    socials: extractSocials(html),
    emails: extractEmails(html),
    anchorSections: extractAnchorSections(html),
  };
}

function pathsFromSitemap(xml: string, origin: string, limit: number): string[] {
  const urls: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && urls.length < limit) {
    try {
      const u = new URL(m[1]);
      if (u.origin === origin) urls.push(u.pathname);
    } catch {}
  }
  return urls;
}

function homepageIsSufficient(page: CrawledPage): boolean {
  // Only skip the deeper crawl when the homepage is genuinely rich —
  // requires meta, substantial body copy, AND signals for pricing + features
  // (those live on their own pages 90% of the time, so we usually expand).
  const hasTitle = page.title.length >= 8;
  const hasDescription = page.description.length >= 80;
  const hasBody = page.text.length >= 8000;
  const lower = page.text.toLowerCase();
  const mentionsPricing = /\$\s?\d|\/mo\b|per month|pricing|free plan|starter|enterprise/.test(lower);
  const mentionsFeatures = /features|capabilities|how it works|what you get/.test(lower);
  return hasTitle && hasDescription && hasBody && mentionsPricing && mentionsFeatures;
}

export async function crawlSite(inputUrl: string): Promise<CrawlResult> {
  const parsed = new URL(inputUrl);
  const origin = parsed.origin;

  const robotsAllowed = await isAllowedByRobots(origin);
  if (!robotsAllowed) {
    return { origin, pages: [], primary: null, robotsAllowed };
  }

  // Phase 1 — homepage (or the specific path the user pasted). Capture headers + raw HTML
  // on the primary page so the fingerprint detector can inspect them.
  const primaryPath = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "/";
  const primaryUrl = origin + primaryPath;
  const primaryRes = await fetchTextWithHeaders(primaryUrl);
  const primary = primaryRes
    ? { ...parsePage(primaryUrl, primaryRes.text), html: primaryRes.text, headers: primaryRes.headers }
    : null;

  if (primary && homepageIsSufficient(primary)) {
    return { origin, pages: [primary], primary, robotsAllowed };
  }

  // Phase 2 — expand only if the homepage was thin.
  const paths = new Set<string>(CANDIDATE_PATHS);
  paths.delete(primaryPath);
  paths.delete("/");

  const sitemapXml = await fetchText(`${origin}/sitemap.xml`, 200_000);
  if (sitemapXml) for (const p of pathsFromSitemap(sitemapXml, origin, 8)) paths.add(p);

  const budget = Math.max(0, MAX_PAGES - (primary ? 1 : 0));
  const extra = await Promise.all(
    Array.from(paths)
      .slice(0, budget)
      .map(async (p) => {
        const url = origin + p;
        const html = await fetchText(url);
        if (!html) return null;
        return parsePage(url, html);
      }),
  );

  const pages = [primary, ...extra].filter((p): p is CrawledPage => p !== null);
  return { origin, pages, primary: primary ?? pages[0] ?? null, robotsAllowed };
}
