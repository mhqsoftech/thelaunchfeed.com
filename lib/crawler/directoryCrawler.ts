import { prisma } from "@/lib/db";
import {
  PREDEFINED_DIRECTORIES,
  type PredefinedDirectory,
  type ExtractedLead,
  type CrawlResult,
} from "./constants";

export { PREDEFINED_DIRECTORIES, type PredefinedDirectory, type ExtractedLead, type CrawlResult };

// Blocklist for generic system/platform noise emails & dummy placeholders
const IGNORED_EMAIL_PATTERNS = [
  /sentry/i,
  /github/i,
  /producthunt\.com/i,
  /cloudflare/i,
  /w3\.org/i,
  /example\.com/i,
  /domain\.com/i,
  /yourdomain/i,
  /youremail/i,
  /test@/i,
  /noreply/i,
  /no-reply/i,
  /mailer-daemon/i,
  /support@producthunt/i,
  /privacy@/i,
  /abuse@/i,
  /postmaster@/i,
  /schema\.org/i,
  /stimpack\.io/i,
  /^you@/i,
  /^someone@/i,
  /^user@/i,
  /^name@/i,
  /^email@/i,
  /^john\.doe@/i,
  /\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot)$/i,
];

/**
 * Strips quotes, escaped slashes, urlencoding, mailto, and query strings from emails
 */
export function cleanEmail(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let s = raw.trim();
  // Strip JSON escapes, quotes, and unicode entities
  s = s.replace(/^[\\"'`(<{\[\s]+|[\\"'`>)}\],\;\s]+$/g, "");
  s = s.replace(/^mailto:/i, "");
  s = s.replace(/^(?:\\?u003c|\\?u003e|u003c|u003e|&lt;|&gt;)+/i, "");
  try {
    s = decodeURIComponent(s);
  } catch {}
  s = s.replace(/^[\\"'`(<{\[\s]+|[\\"'`>)}\],\;\s]+$/g, "");
  s = s.replace(/^(?:\\?u003c|\\?u003e|u003c|u003e|&lt;|&gt;)+/i, "");
  // Strip any query parameter or fragment
  s = s.split("?")[0].split("#")[0].trim();
  // Extract strictly the email part if there are remaining wrapper characters
  const match = s.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (!match) return "";
  let clean = match[0].toLowerCase().trim();
  clean = clean.replace(/^(?:u003c|u003e)/i, "");
  return clean;
}

/**
 * Checks if an email is clean, not a known system noise address,
 * and does not belong to the host directory itself (e.g. hi@startupfa.me, support@fazier.com)
 */
export function isValidContactEmail(raw: string, directoryHostDomain?: string): boolean {
  const email = cleanEmail(raw);
  if (!email || email.length < 5 || email.length > 80) return false;
  for (const pattern of IGNORED_EMAIL_PATTERNS) {
    if (pattern.test(email)) return false;
  }
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [user, domain] = parts;
  if (!user || !domain || !domain.includes(".")) return false;

  // Filter out host directory's own domain (e.g. hi@startupfa.me, team@fazier.com, etc.)
  if (directoryHostDomain) {
    const cleanHost = directoryHostDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase().trim();
    if (cleanHost && (domain === cleanHost || domain.endsWith("." + cleanHost) || cleanHost.includes(domain))) {
      return false;
    }
  }

  // Also check all predefined directory host domains to prevent saving directory staff emails
  for (const pDir of PREDEFINED_DIRECTORIES) {
    const pHost = pDir.url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase().trim();
    if (pHost && (domain === pHost || domain.endsWith("." + pHost))) {
      return false;
    }
  }

  // Filter package version numbers or library strings (e.g. pinia@2.1.7, react@18.2, etc.)
  if (/^\d+\.\d+/.test(domain) || /\.(prod|min|esm|cjs|mjs|bundle|map)$/i.test(domain)) {
    return false;
  }
  if (/^(npm|yarn|pnpm|pkg|version|node_modules)$/i.test(user)) {
    return false;
  }

  // Ensure TLD has valid alphabetic characters (2-12 letters)
  const tld = domain.split(".").pop();
  if (!tld || !/^[a-zA-Z]{2,12}$/.test(tld)) return false;

  if (domain.endsWith(".png") || domain.endsWith(".js") || domain.endsWith(".css") || domain.endsWith(".dev")) {
    if (domain.endsWith(".workers.dev") || domain.endsWith(".png")) return false;
  }
  return true;
}

function cleanTextSnippet(text: string): string {
  if (!text || typeof text !== "string") return "";
  let clean = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[\\"'`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // If text contains code keywords or invalid syntax, discard
  if (
    clean.startsWith("<") ||
    clean.startsWith("{") ||
    clean.startsWith("@") ||
    clean.startsWith("$") ||
    clean.includes("function(") ||
    clean.includes("document.") ||
    clean.includes("getElementById") ||
    clean.includes("context:") ||
    clean.includes("var ") ||
    clean.includes("let ") ||
    clean.includes("const ") ||
    clean.includes("window.")
  ) {
    return "";
  }
  return clean.slice(0, 60);
}

/**
 * Extracts emails, names, and organizations from raw text or HTML markup
 */
export function extractLeadsFromText(
  content: string,
  defaultDirectory = "Direct Import",
  sourceUrl?: string,
  directoryHostDomain?: string
): ExtractedLead[] {
  if (!content || typeof content !== "string") return [];

  // Strip script, style, and comments before any text processing
  const cleanBody = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const leads: ExtractedLead[] = [];
  const seenEmails = new Set<string>();

  // Determine directory host domain from sourceUrl if not explicitly passed
  let hostDomain = directoryHostDomain;
  if (!hostDomain && sourceUrl && sourceUrl.startsWith("http")) {
    try {
      hostDomain = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
    } catch {}
  }

  // Check if content is CSV format (headers: name, email, organization / product)
  const lines = cleanBody.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const isCsv = lines.some((l) => l.includes(",") || l.includes("\t"));

  if (isCsv && lines.length > 0) {
    for (const line of lines) {
      const parts = line.split(/[,\t]/).map((p) => cleanTextSnippet(p));
      // Find email part in line
      const emailPart = parts.find((p) => isValidContactEmail(p, hostDomain));
      if (emailPart) {
        const sanitized = cleanEmail(emailPart);
        if (sanitized && !seenEmails.has(sanitized)) {
          seenEmails.add(sanitized);
          const otherParts = parts.filter((p) => cleanEmail(p) !== sanitized);
          const name = otherParts[0] || "";
          const organization = otherParts[1] || otherParts[0] || "Featured Product";
          const productUrl = otherParts.find((p) => p.startsWith("http://") || p.startsWith("https://"));

          leads.push({
            name,
            email: sanitized,
            organization,
            productUrl,
            sourceDirectory: defaultDirectory,
            sourceUrl,
          });
        }
      }
    }
  }

  // Regex to match emails in free-form text
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matchedEmails = cleanBody.match(EMAIL_REGEX) || [];
  for (const rawEmail of matchedEmails) {
    const sanitized = cleanEmail(rawEmail);
    if (sanitized && !seenEmails.has(sanitized) && isValidContactEmail(sanitized, hostDomain)) {
      seenEmails.add(sanitized);

      // Attempt to infer name/company near the email position
      const emailIndex = cleanBody.indexOf(rawEmail);
      const snippet = cleanBody.slice(Math.max(0, emailIndex - 140), Math.min(cleanBody.length, emailIndex + 140));
      const cleanSnippet = cleanTextSnippet(snippet);

      let inferredName = "";
      let inferredOrg = "";

      const nameMatch = cleanSnippet.match(/(?:founder|maker|author|name|by|from)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (nameMatch && nameMatch[1]) {
        inferredName = cleanTextSnippet(nameMatch[1]);
      }

      const orgMatch = cleanSnippet.match(/(?:product|company|startup|app|tool)[:\s]+([A-Za-z0-9\s-_]{2,30})/i);
      if (orgMatch && orgMatch[1]) {
        inferredOrg = cleanTextSnippet(orgMatch[1]);
      }

      // If org is still empty, derive from domain
      if (!inferredOrg) {
        const domain = sanitized.split("@")[1];
        const domainName = domain.split(".")[0];
        if (domainName && !["gmail", "yahoo", "outlook", "hotmail", "icloud", "proton", "protonmail"].includes(domainName)) {
          inferredOrg = domainName.charAt(0).toUpperCase() + domainName.slice(1);
        }
      }

      leads.push({
        name: inferredName,
        email: sanitized,
        organization: inferredOrg || defaultDirectory,
        sourceDirectory: defaultDirectory,
        sourceUrl,
      });
    }
  }

  return leads;
}

/**
 * Parses RSS 2.0, Atom, and RDF XML feeds to extract product launches and creator leads
 */
export function parseFeedXml(
  xmlContent: string,
  defaultDirectory = "Direct Feed",
  sourceUrl?: string,
  directoryHostDomain?: string
): { leads: ExtractedLead[]; discoveredLinks: { name: string; url: string }[] } {
  const leads: ExtractedLead[] = [];
  const discoveredLinks: { name: string; url: string }[] = [];
  const seenEmails = new Set<string>();

  if (!xmlContent || typeof xmlContent !== "string") {
    return { leads, discoveredLinks };
  }

  // 1. RSS 2.0 & RDF <item> Blocks
  const rssItemMatches = Array.from(xmlContent.matchAll(/<item[\s\S]*?<\/item>/gi));
  for (const m of rssItemMatches) {
    const itemXml = m[0];
    const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch =
      itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) ||
      itemXml.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i);
    const creatorMatch =
      itemXml.match(/<dc:creator[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/i) ||
      itemXml.match(/<author[^>]*>[\s\S]*?<name[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/name>/i);
    const descMatch = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);

    const title = titleMatch ? cleanTextSnippet(titleMatch[1]) : "";
    const link = linkMatch ? cleanTextSnippet(linkMatch[1]).split("?")[0] : "";
    const creator = creatorMatch ? cleanTextSnippet(creatorMatch[1]) : "";
    const desc = descMatch ? descMatch[1] : "";

    if (link && link.startsWith("http")) {
      discoveredLinks.push({ name: title || defaultDirectory, url: link });
    }

    // Extract direct emails from author or description
    const emailMatches = Array.from((itemXml + " " + desc).matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi));
    for (const em of emailMatches) {
      const sanitized = cleanEmail(em[0]);
      if (sanitized && !seenEmails.has(sanitized) && isValidContactEmail(sanitized, directoryHostDomain)) {
        seenEmails.add(sanitized);
        leads.push({
          name: creator,
          email: sanitized,
          organization: title || defaultDirectory,
          productUrl: link || undefined,
          sourceDirectory: defaultDirectory,
          sourceUrl,
        });
      }
    }
  }

  // 2. Atom <entry> Blocks
  const atomEntryMatches = Array.from(xmlContent.matchAll(/<entry[\s\S]*?<\/entry>/gi));
  for (const m of atomEntryMatches) {
    const entryXml = m[0];
    const titleMatch = entryXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch =
      entryXml.match(/<link[^>]*href=["']([^"']+)["']/i) ||
      entryXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const authorMatch =
      entryXml.match(/<author[^>]*>[\s\S]*?<name[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/name>/i);
    const authorEmailMatch =
      entryXml.match(/<author[^>]*>[\s\S]*?<email[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/email>/i);
    const summaryMatch =
      entryXml.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i) ||
      entryXml.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i);

    const title = titleMatch ? cleanTextSnippet(titleMatch[1]) : "";
    const link = linkMatch ? cleanTextSnippet(linkMatch[1]).split("?")[0] : "";
    const authorName = authorMatch ? cleanTextSnippet(authorMatch[1]) : "";
    const directEmail = authorEmailMatch ? cleanEmail(authorEmailMatch[1]) : "";
    const summary = summaryMatch ? summaryMatch[1] : "";

    if (link && link.startsWith("http")) {
      discoveredLinks.push({ name: title || defaultDirectory, url: link });
    }

    if (directEmail && isValidContactEmail(directEmail, directoryHostDomain) && !seenEmails.has(directEmail)) {
      seenEmails.add(directEmail);
      leads.push({
        name: authorName,
        email: directEmail,
        organization: title || defaultDirectory,
        productUrl: link || undefined,
        sourceDirectory: defaultDirectory,
        sourceUrl,
      });
    }

    // Extract any additional emails in summary/content
    const emailMatches = Array.from(summary.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi));
    for (const em of emailMatches) {
      const sanitized = cleanEmail(em[0]);
      if (sanitized && !seenEmails.has(sanitized) && isValidContactEmail(sanitized, directoryHostDomain)) {
        seenEmails.add(sanitized);
        leads.push({
          name: authorName,
          email: sanitized,
          organization: title || defaultDirectory,
          productUrl: link || undefined,
          sourceDirectory: defaultDirectory,
          sourceUrl,
        });
      }
    }
  }

  return { leads, discoveredLinks };
}

/**
 * Crawls a webpage URL and extracts founder/product lead contact information
 * Supports multi-section discovery across Daily, Weekly, Monthly, RSS/Atom Feeds, and Outbound Product Sites
 */
export async function crawlDirectoryUrl(
  url: string,
  sourceDirectoryName?: string
): Promise<CrawlResult> {
  const targetUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
  const hostDomain = new URL(targetUrl).hostname.replace(/^www\./, "").toLowerCase();
  const dirName =
    sourceDirectoryName ||
    PREDEFINED_DIRECTORIES.find((d) => targetUrl.includes(d.id) || targetUrl.includes(d.url.replace(/^https?:\/\//, "")))?.name ||
    new URL(targetUrl).hostname.replace(/^www\./, "");

  const leads: ExtractedLead[] = [];
  const seenEmails = new Set<string>();
  const discoveredProducts: { name: string; url: string; detailUrl?: string }[] = [];
  let feedScanned = false;
  let feedItemsFound = 0;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const rawContent = await response.text();

    // 0. Check if the targetUrl itself is an RSS, Atom, or XML feed
    const isDirectXmlFeed =
      rawContent.trim().startsWith("<?xml") ||
      rawContent.includes("<rss") ||
      rawContent.includes("<feed xmlns") ||
      targetUrl.endsWith(".xml") ||
      targetUrl.includes("/feed") ||
      targetUrl.includes("/rss");

    if (isDirectXmlFeed) {
      feedScanned = true;
      const feedRes = parseFeedXml(rawContent, dirName, targetUrl, hostDomain);
      feedItemsFound += feedRes.discoveredLinks.length;
      for (const fl of feedRes.leads) {
        if (!seenEmails.has(fl.email) && isValidContactEmail(fl.email, hostDomain)) {
          seenEmails.add(fl.email);
          leads.push(fl);
        }
      }
      for (const dl of feedRes.discoveredLinks) {
        if (!discoveredProducts.some((p) => p.url === dl.url)) {
          discoveredProducts.push({ name: dl.name, url: dl.url });
        }
      }
    }

    const html = rawContent;

    // 1. Parallel Feed Prober & Extractor (Look for <link rel="alternate" type="application/rss+xml"> or standard feed paths)
    const feedUrlsToProbe: string[] = [];
    const feedLinkMatches = Array.from(
      html.matchAll(/<link[^>]+type=["']application\/(?:rss\+xml|atom\+xml)["'][^>]*href=["']([^"']+)["']/gi)
    ).map((m) => m[1]);

    for (const fl of feedLinkMatches) {
      try {
        const fullFeed = new URL(fl, targetUrl).toString();
        if (!feedUrlsToProbe.includes(fullFeed)) feedUrlsToProbe.push(fullFeed);
      } catch {}
    }

    // Also add common standard feed endpoints if none discovered in link tags
    if (feedUrlsToProbe.length === 0 && !isDirectXmlFeed) {
      const origin = new URL(targetUrl).origin;
      feedUrlsToProbe.push(`${origin}/feed.xml`, `${origin}/rss.xml`, `${origin}/feed`, `${origin}/atom.xml`);
    }

    if (feedUrlsToProbe.length > 0 && !isDirectXmlFeed) {
      await Promise.all(
        feedUrlsToProbe.slice(0, 3).map(async (fUrl) => {
          try {
            const fCtrl = new AbortController();
            const fTimeout = setTimeout(() => fCtrl.abort(), 4000);
            const fRes = await fetch(fUrl, {
              signal: fCtrl.signal,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                Accept: "application/rss+xml, application/atom+xml, text/xml, */*",
              },
            });
            clearTimeout(fTimeout);

            if (fRes.ok) {
              const fXml = await fRes.text();
              if (fXml.includes("<item") || fXml.includes("<entry")) {
                feedScanned = true;
                const parsedFeed = parseFeedXml(fXml, dirName, fUrl, hostDomain);
                feedItemsFound += parsedFeed.discoveredLinks.length;
                for (const fl of parsedFeed.leads) {
                  if (!seenEmails.has(fl.email) && isValidContactEmail(fl.email, hostDomain)) {
                    seenEmails.add(fl.email);
                    leads.push(fl);
                  }
                }
                for (const dl of parsedFeed.discoveredLinks) {
                  if (!discoveredProducts.some((p) => p.url === dl.url)) {
                    discoveredProducts.push({ name: dl.name, url: dl.url });
                  }
                }
              }
            }
          } catch {}
        })
      );
    }

    // 2. Next.js / React Dehydrated State Extraction (__NEXT_DATA__)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const json = JSON.parse(nextDataMatch[1]);
        const pageProps = json.props?.pageProps || {};

        const extractPosts = (groupList: any[]) => {
          if (!Array.isArray(groupList)) return;
          for (const item of groupList) {
            if (Array.isArray(item.posts)) {
              for (const p of item.posts) {
                if (p && p.name) {
                  discoveredProducts.push({
                    name: cleanTextSnippet(p.name),
                    url: p.product_url || p.website || p.url || "",
                    detailUrl: p.slug ? new URL(`/launches/${p.slug}`, targetUrl).toString() : undefined,
                  });
                }
              }
            } else if (item && item.name) {
              discoveredProducts.push({
                name: cleanTextSnippet(item.name),
                url: item.product_url || item.website || item.url || "",
                detailUrl: item.slug ? new URL(`/launches/${item.slug}`, targetUrl).toString() : undefined,
              });
            }
          }
        };

        // Scan Daily, Weekly, Monthly, and Ads sections
        extractPosts(pageProps.posts);
        extractPosts(pageProps.weeklyPosts);
        extractPosts(pageProps.monthlyPosts);
        extractPosts(pageProps.allTimePosts);
        extractPosts(pageProps.premiumAds);
        extractPosts(pageProps.sponsorAds);
        extractPosts(pageProps.products);
        extractPosts(pageProps.items);
      } catch (err) {
        console.warn("[crawler] Error parsing NextData state:", err);
      }
    }

    // 3. Check for JSON-LD Structured Metadata (Schema.org)
    const jsonLdMatches = html.match(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi) || [];
    for (const tag of jsonLdMatches) {
      try {
        const rawJson = tag.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
        const parsed = JSON.parse(rawJson);
        const items = Array.isArray(parsed) ? parsed : [parsed];

        for (const item of items) {
          const authorEmail = item.author?.email || item.creator?.email || item.founder?.email || item.email;
          const authorName = item.author?.name || item.creator?.name || item.founder?.name || item.name;
          const orgName = item.name || item.legalName || item.brand?.name;

          if (authorEmail && isValidContactEmail(authorEmail, hostDomain)) {
            const sanitized = cleanEmail(String(authorEmail));
            if (sanitized && !seenEmails.has(sanitized)) {
              seenEmails.add(sanitized);
              leads.push({
                name: typeof authorName === "string" ? cleanTextSnippet(authorName) : "",
                email: sanitized,
                organization: typeof orgName === "string" ? cleanTextSnippet(orgName) : dirName,
                productUrl: item.url || targetUrl,
                sourceDirectory: dirName,
                sourceUrl: targetUrl,
              });
            }
          }
        }
      } catch {}
    }

    // 3. Parse mailto: links in the HTML
    const mailtoMatches = html.match(/href=["']mailto:([^"'?]+)(?:\?[^"']*)?["']/gi) || [];
    for (const match of mailtoMatches) {
      const raw = match.replace(/href=["']mailto:/i, "").replace(/["'].*$/, "").split("?")[0];
      const sanitized = cleanEmail(raw);
      if (sanitized && isValidContactEmail(sanitized) && !seenEmails.has(sanitized)) {
        seenEmails.add(sanitized);

        const domain = sanitized.split("@")[1];
        const domainName = domain ? domain.split(".")[0] : "";
        const org = domainName ? domainName.charAt(0).toUpperCase() + domainName.slice(1) : dirName;

        leads.push({
          name: "",
          email: sanitized,
          organization: org,
          sourceDirectory: dirName,
          sourceUrl: targetUrl,
        });
      }
    }

    // 4. Deep Product Cards & Outbound Links Scanner (HTML links + React Server Component payloads)
    const linkMatches = Array.from(html.matchAll(/href=["'](\/[^"'#?]+|https?:\/\/[^"'#?]+)["']/gi));
    for (const match of linkMatches) {
      const link = match[1];
      if (!link) continue;

      const isInternalToolPage =
        link.startsWith("/s/") ||
        link.startsWith("/p/") ||
        link.startsWith("/deal/") ||
        link.startsWith("/deals/") ||
        link.startsWith("/tool/") ||
        link.startsWith("/tools/") ||
        link.startsWith("/product/") ||
        link.startsWith("/products/") ||
        link.startsWith("/startup/") ||
        link.startsWith("/startups/") ||
        link.startsWith("/project/") ||
        link.startsWith("/projects/") ||
        link.startsWith("/app/") ||
        link.startsWith("/apps/") ||
        link.startsWith("/item/") ||
        link.startsWith("/items/") ||
        link.startsWith("/launch/") ||
        link.startsWith("/launches/") ||
        link.startsWith("/post/") ||
        link.startsWith("/posts/");

      let fullSubUrl = "";
      if (isInternalToolPage) {
        fullSubUrl = new URL(link, targetUrl).toString();
      } else if (
        link.startsWith("http") &&
        !link.includes("twitter.com") &&
        !link.includes("x.com") &&
        !link.includes("facebook.com") &&
        !link.includes("google.com") &&
        !link.includes("linkedin.com") &&
        !link.includes("github.com") &&
        !link.includes("sentry.io") &&
        !link.includes("stripe.com") &&
        !link.includes(new URL(targetUrl).hostname)
      ) {
        fullSubUrl = link;
      }

      if (fullSubUrl && !discoveredProducts.some((p) => p.url === fullSubUrl || p.detailUrl === fullSubUrl)) {
        const urlObj = new URL(fullSubUrl);
        const nameFromPath = urlObj.pathname.split("/").filter(Boolean).pop() || urlObj.hostname.replace(/^www\./, "").split(".")[0];
        const orgName = nameFromPath ? nameFromPath.charAt(0).toUpperCase() + nameFromPath.slice(1) : dirName;
        discoveredProducts.push({
          name: orgName,
          url: fullSubUrl.startsWith("http") && !isInternalToolPage ? fullSubUrl : "",
          detailUrl: isInternalToolPage ? fullSubUrl : undefined,
        });
      }
    }

    // 5. Concurrently crawl discovered product landing pages & launch detail pages (up to 30 in parallel)
    const targetsToScrape = discoveredProducts.slice(0, 30);
    if (targetsToScrape.length > 0) {
      await Promise.all(
        targetsToScrape.map(async (prod) => {
          let directWebsiteUrl = prod.url;
          let makerName = "";
          let orgName = prod.name;

          // If this is an internal launch detail page (e.g. /s/xyz, /launches/xyz, or /p/xyz), fetch to get outbound site & maker
          if (prod.detailUrl) {
            try {
              const dtCtrl = new AbortController();
              const dtTimeout = setTimeout(() => dtCtrl.abort(), 6000);
              const dtRes = await fetch(prod.detailUrl, {
                signal: dtCtrl.signal,
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
              });
              clearTimeout(dtTimeout);

              if (dtRes.ok) {
                const dtHtml = await dtRes.text();

                // Check NextData for launch metadata
                const dtNextMatch = dtHtml.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
                if (dtNextMatch) {
                  try {
                    const dtJson = JSON.parse(dtNextMatch[1]);
                    const launch =
                      dtJson.props?.pageProps?.initialData?.object?.launch ||
                      dtJson.props?.pageProps?.post ||
                      dtJson.props?.pageProps?.product;
                    if (launch) {
                      if (launch.name) orgName = cleanTextSnippet(launch.name);
                      if (launch.product_url) directWebsiteUrl = launch.product_url.split("?")[0];
                      if (Array.isArray(launch.makers) && launch.makers[0]?.name) {
                        makerName = cleanTextSnippet(launch.makers[0].name);
                      }
                    }
                  } catch {}
                }

                // If outbound URL not found via JSON, inspect all links & RSC payloads in detail page
                if (!directWebsiteUrl) {
                  const rawUrls = Array.from(
                    dtHtml.matchAll(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"'\\]*)?/gi)
                  ).map((m) => m[0].replace(/[\\"'`>,)}]+$/, "").split("?")[0].split("#")[0]);

                  const uniqueUrls = Array.from(new Set(rawUrls));
                  const foundSite = uniqueUrls.find(
                    (u) =>
                      !u.includes(new URL(targetUrl).hostname) &&
                      !u.includes("x.com") &&
                      !u.includes("twitter.com") &&
                      !u.includes("facebook.com") &&
                      !u.includes("google.com") &&
                      !u.includes("linkedin.com") &&
                      !u.includes("github.com") &&
                      !u.includes("stripe.com") &&
                      !u.includes("sentry.io") &&
                      !u.includes("userjot") &&
                      !u.includes("betteruptime") &&
                      !u.includes("schema.org") &&
                      !u.includes("w3.org") &&
                      !u.includes("seline.com")
                  );
                  if (foundSite) {
                    directWebsiteUrl = foundSite;
                  }
                }

                // Also check if emails exist directly on detail page
                const detailLeads = extractLeadsFromText(dtHtml, dirName, prod.detailUrl, hostDomain);
                for (const dl of detailLeads) {
                  if (dl.email && !seenEmails.has(dl.email) && isValidContactEmail(dl.email, hostDomain)) {
                    seenEmails.add(dl.email);
                    leads.push({
                      ...dl,
                      name: makerName || dl.name,
                      organization: orgName || dl.organization || dirName,
                      sourceDirectory: dirName,
                    });
                  }
                }
              }
            } catch {}
          }

          // If we have an external product website URL, scrape it for contact/founder emails
          if (directWebsiteUrl && directWebsiteUrl.startsWith("http")) {
            try {
              const wsCtrl = new AbortController();
              const wsTimeout = setTimeout(() => wsCtrl.abort(), 6000);
              const wsRes = await fetch(directWebsiteUrl, {
                signal: wsCtrl.signal,
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
              });
              clearTimeout(wsTimeout);

              if (wsRes.ok) {
                const wsHtml = await wsRes.text();
                const wsLeads = extractLeadsFromText(wsHtml, dirName, directWebsiteUrl, hostDomain);
                for (const wl of wsLeads) {
                  if (wl.email && !seenEmails.has(wl.email) && isValidContactEmail(wl.email, hostDomain)) {
                    seenEmails.add(wl.email);
                    leads.push({
                      ...wl,
                      name: makerName || wl.name,
                      organization: orgName || wl.organization || dirName,
                      productUrl: directWebsiteUrl,
                      sourceDirectory: dirName,
                      sourceUrl: prod.detailUrl || directWebsiteUrl,
                    });
                  }
                }
              }
            } catch {}
          }
        })
      );
    }

    // 6. Fallback: Parse whole main page text with regex and heuristics
    const textLeads = extractLeadsFromText(html, dirName, targetUrl);
    for (const tLead of textLeads) {
      if (!seenEmails.has(tLead.email) && isValidContactEmail(tLead.email)) {
        seenEmails.add(tLead.email);
        leads.push(tLead);
      }
    }
  } catch (err: any) {
    console.warn(`[crawler] Error crawling ${targetUrl}:`, err?.message || err);
  }

  // Deduplicate and Upsert into PostgreSQL
  let newLeadsSaved = 0;
  let existingLeadsUpdated = 0;

  for (const lead of leads) {
    try {
      const existing = await prisma.directoryLead.findUnique({
        where: { email: lead.email },
      });

      if (existing) {
        existingLeadsUpdated++;
        // Update if new details are available
        await prisma.directoryLead.update({
          where: { id: existing.id },
          data: {
            name: lead.name || existing.name,
            organization: lead.organization || existing.organization,
            productUrl: lead.productUrl || existing.productUrl,
            sourceDirectory: lead.sourceDirectory || existing.sourceDirectory,
            sourceUrl: lead.sourceUrl || existing.sourceUrl,
          },
        });
      } else {
        newLeadsSaved++;
        await prisma.directoryLead.create({
          data: {
            name: lead.name,
            email: lead.email,
            organization: lead.organization,
            productUrl: lead.productUrl,
            sourceDirectory: lead.sourceDirectory,
            sourceUrl: lead.sourceUrl,
            status: "NEW",
          },
        });
      }
    } catch (dbErr) {
      console.warn(`[crawler] Database save error for ${lead.email}:`, dbErr);
    }
  }

  return {
    sourceDirectory: dirName,
    sourceUrl: targetUrl,
    leadsFound: leads.length,
    newLeadsSaved,
    existingLeadsUpdated,
    feedScanned,
    feedItemsFound,
    leads,
  };
}

/**
 * Bulk import multiple raw leads and upsert them safely into the database
 */
export async function saveBulkLeads(
  leads: ExtractedLead[]
): Promise<{ total: number; created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const lead of leads) {
    if (!isValidContactEmail(lead.email)) continue;
    const cleanEmail = lead.email.toLowerCase().trim();

    try {
      const existing = await prisma.directoryLead.findUnique({
        where: { email: cleanEmail },
      });

      if (existing) {
        updated++;
        await prisma.directoryLead.update({
          where: { id: existing.id },
          data: {
            name: lead.name || existing.name,
            organization: lead.organization || existing.organization,
            productUrl: lead.productUrl || existing.productUrl,
            sourceDirectory: lead.sourceDirectory || existing.sourceDirectory,
            sourceUrl: lead.sourceUrl || existing.sourceUrl,
          },
        });
      } else {
        created++;
        await prisma.directoryLead.create({
          data: {
            name: lead.name || "",
            email: cleanEmail,
            organization: lead.organization || "Featured Startup",
            productUrl: lead.productUrl,
            sourceDirectory: lead.sourceDirectory || "Manual Import",
            sourceUrl: lead.sourceUrl,
            status: "NEW",
          },
        });
      }
    } catch (err) {
      console.warn(`[crawler] Error saving lead ${cleanEmail}:`, err);
    }
  }

  return { total: leads.length, created, updated };
}
