import type { CrawlResult } from "./crawler";
import type { GitHubRepoInfo } from "./github";
import { detectFromHtml, mergeFingerprints, fingerprintSummary, type TechFingerprint } from "./fingerprint";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MAX_INPUT_CHARS = 90_000;
const MAX_OUTPUT_TOKENS = 12_000;

export type ExtractedProduct = {
  name: string;
  tagline: string;
  category: string;
  makerName: string;
  makerHandle: string;
  websiteUrl: string;
  githubUrl: string;
  revenue: string;
  overviewPitch: string;
  features: string[];
  targetAudience: string;
  pricingTiers: { name: string; price: string; specs: string }[];
  techStack: string;
  infraHosting: string;
  apiUrl: string;
  securityStandards: string;
  originStory: string;
  makerThesis: string;
  latestVersion: string;
  latestChangelog: string;
  roadmapQ3: string;
  roadmapQ4: string;
  pricingPartner: string;
  faqs: { q: string; a: string }[];
  supportEmail: string;
  tags: string;
  videoUrl?: string;
  ogImage: string;
  favicon: string;
  appleTouchIcon: string;
  logoCandidates: string[];
  socials: string[];
};

type JsonSchema = Record<string, unknown>;

// Category free-form — the submit form validates against the live category
// list from the DB, so the LLM is intentionally not constrained here.
const SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    tagline: { type: "string", description: "One crisp line, ≤100 chars, no trailing period. Prefer verbatim from hero H1/H2/meta/README subtitle. If none present, write a professional 8-14 word tagline grounded strictly in the product's stated purpose." },
    category: { type: "string" },
    makerName: { type: "string", description: "Founder/maker ONLY if named on about/team/footer/README author. Empty if not stated (never invent a name)." },
    makerHandle: { type: "string", description: "Twitter/X handle including @, ONLY if linked in source. Empty otherwise (never invent)." },
    websiteUrl: { type: "string" },
    githubUrl: { type: "string" },
    revenue: { type: "string", description: "Monthly revenue ONLY if explicitly stated (e.g. $12K/mo). Empty otherwise. NEVER invent — this is a verifiable claim." },
    overviewPitch: { type: "string", description: "Long-form pitch, MINIMUM 1500 characters, ideally 1800-2400. 4-6 paragraphs separated by double newlines. Grounded in the corpus (no invented numbers, customer counts, revenue, awards, or endorsements) but exhaustively elaborate every stated feature, capability, integration, audience, use case, and outcome. Never leave empty." },
    features: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
      description: "Concrete product capabilities pulled from features/product/docs pages or README. One sentence each. Aim for at least 3; if the corpus lists fewer explicitly, distill 3 grounded capability sentences from whatever product description exists.",
    },
    targetAudience: { type: "string", description: "Who the product is for. Prefer verbatim from source ('built for X'). If not explicitly stated, infer 1-2 sentences grounded strictly in the product's stated purpose and capabilities (e.g. category + primary workflow). Never leave empty." },
    pricingTiers: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Tier name verbatim (Free, Pro, Team, Enterprise, etc.)." },
          price: { type: "string", description: "Just the price string as shown, e.g. '$0', '$29/mo', '$299/yr', 'Custom', 'Contact us'. Empty if no price shown." },
          specs: { type: "string", description: "What's included in this tier, verbatim from the pricing page (comma-separated features/limits)." },
        },
        required: ["name", "price", "specs"],
      },
      description: "VERBATIM-ONLY. Include tiers explicitly present on the pricing/plans page. If no pricing page is in the corpus, return an EMPTY array. Never invent prices or tier structures.",
    },
    techStack: { type: "string", description: "Comma-separated stack. First use every item from the DETECTED TECHNOLOGIES block. Then add technologies explicitly named in page copy (docs code samples, README badges, careers). If the fingerprint is thin, add 3-5 additional web technologies typical for this category (e.g. 'TypeScript, Next.js, PostgreSQL' for a modern SaaS), but do NOT list branded products (Stripe, Auth0) unless detected/named. Never leave empty." },
    infraHosting: { type: "string", description: "Cloud/infra provider. Prefer HOSTING/CDN entries from the DETECTED TECHNOLOGIES block and providers explicitly named in source. If none detected/named, describe the deployment model in generic terms grounded in the product ('Managed cloud SaaS' / 'Self-hostable Docker container' / 'Edge-first serverless'). Never leave empty." },
    apiUrl: { type: "string", description: "Public API base URL ONLY if documented (docs, developer, or API page URL). Empty otherwise (never invent an endpoint)." },
    securityStandards: { type: "string", description: "Compliance badges (SOC2, ISO 27001, GDPR, HIPAA, PCI) as stated on security/trust page. If none stated, write a 1-line grounded description of standard practices (e.g. 'Encrypted at rest and in transit, role-based access control, least-privilege service credentials, GDPR-aligned data handling.'). Never leave empty." },
    originStory: { type: "string", description: "Founding narrative, 2-3 paragraphs, separated by double newlines. Prefer paraphrasing about/story/README/founder blog. If no such content exists, write a grounded, non-fabricated narrative from what IS in the corpus (problem observed → product built to solve it → who benefits). Never invent names, dates, funding rounds, or customer stories. Never leave empty." },
    makerThesis: { type: "string", description: "Founder POV / mission, 1-2 paragraphs. Prefer paraphrasing manifesto/mission/opinionated blog copy. If not stated, distill the product's stated purpose and target audience into a first-principles thesis about why this product matters. Never leave empty." },
    latestVersion: { type: "string", description: "Latest release/version string. Prefer verbatim from changelog/release notes/badge. If not stated, return 'v1.0' as a safe placeholder the founder can edit. Never invent a specific higher version." },
    latestChangelog: { type: "string", description: "Summary of the most recent release notes. Prefer verbatim. If no changelog in corpus, write a grounded 'Initial public launch — <core capability>' style summary using the product's stated core features. Never leave empty." },
    roadmapQ3: { type: "string", description: "Near-term roadmap item (1-2 sentences). Prefer verbatim from a public roadmap. If none, propose ONE grounded next step consistent with the stated product direction (e.g. 'Deeper integration with X', 'Public API expansion for Y'). Never leave empty. Never claim funding, hiring, or customer numbers." },
    roadmapQ4: { type: "string", description: "Mid-term roadmap item (1-2 sentences). Prefer verbatim. If none, propose ONE further grounded step. Never leave empty. Never claim funding, hiring, or customer numbers." },
    pricingPartner: { type: "string", description: "Payment provider. Prefer PAYMENTS entry from the DETECTED TECHNOLOGIES block or providers named in checkout links/terms. If none detected/named, return 'stripe' as the safe default the founder can change. Never leave empty." },
    tags: { type: "string", description: "5-8 comma-separated single-word or short-phrase tags describing the product (e.g. 'ai, developer-tools, open-source, cli, self-hosted'). Grounded in the product's actual category, capabilities, and target audience. Lowercase, hyphenated for multi-word. Never leave empty." },
    videoUrl: { type: "string", description: "Public YouTube, Loom, Vimeo, or video demo link ONLY if explicitly present in the crawled pages (embed src, video iframe, or demo video link). Empty string otherwise." },
    faqs: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: { q: { type: "string" }, a: { type: "string" } },
        required: ["q", "a"],
      },
      description: "3-6 FAQ Q&A pairs. Extract from FAQ page if present, OR generate high-value FAQ pairs derived strictly from website content details (product purpose, tech stack, capabilities, pricing, support). EVERY FAQ MUST HAVE BOTH A CLEAR QUESTION ('q') AND A DETAILED, HELPFUL ANSWER ('a') grounded in the website details. NEVER leave answer 'a' empty.",
    },
    supportEmail: { type: "string", description: "Support/contact email ONLY from published mailto: links or a contact page. Empty otherwise." },
  },
  required: [
    "name",
    "tagline",
    "category",
    "makerName",
    "makerHandle",
    "websiteUrl",
    "githubUrl",
    "revenue",
    "overviewPitch",
    "features",
    "targetAudience",
    "pricingTiers",
    "techStack",
    "infraHosting",
    "apiUrl",
    "securityStandards",
    "originStory",
    "makerThesis",
    "latestVersion",
    "latestChangelog",
    "roadmapQ3",
    "roadmapQ4",
    "pricingPartner",
    "faqs",
    "supportEmail",
    "tags",
  ],
};

function buildCorpus(crawl: CrawlResult | null, gh: GitHubRepoInfo | null, fp: TechFingerprint): string {
  const parts: string[] = [];

  if (fingerprintSummary(fp)) {
    parts.push(
      `# DETECTED TECHNOLOGIES (authoritative — from HTTP headers, script tags, meta generator, and GitHub /languages API)\n${fingerprintSummary(fp)}\n\nRULE: For techStack and infraHosting, use ONLY items from the lists above. Do not add any technology, framework, or infrastructure that is not detected here or explicitly named in the page copy below. If no relevant items are detected, return empty string.`,
    );
  }

  if (crawl?.primary) {
    parts.push(`# PRIMARY PAGE ${crawl.primary.url}\nTITLE: ${crawl.primary.title}\nDESC: ${crawl.primary.description}\n${crawl.primary.text}`);
  }
  if (crawl) {
    for (const p of crawl.pages) {
      if (p === crawl.primary) continue;
      parts.push(`# PAGE ${p.url}\nTITLE: ${p.title}\nDESC: ${p.description}\n${p.text}`);
    }
    // Dedicated anchor sections (e.g. #pricing on a single-page site) get their own
    // clearly-labeled block so the model treats them as authoritative for that field.
    const anchorBlocks: string[] = [];
    for (const p of crawl.pages) {
      for (const [id, text] of Object.entries(p.anchorSections ?? {})) {
        anchorBlocks.push(`# ANCHOR SECTION #${id} (from ${p.url}#${id})\n${text}`);
      }
    }
    if (anchorBlocks.length) parts.push(anchorBlocks.join("\n\n"));

    if (crawl.pages.length) {
      const socials = Array.from(new Set(crawl.pages.flatMap((p) => p.socials)));
      if (socials.length) parts.push(`# SOCIAL LINKS\n${socials.join("\n")}`);

      const emails = Array.from(new Set(crawl.pages.flatMap((p) => p.emails ?? [])));
      if (emails.length) parts.push(`# CONTACT & SUPPORT EMAILS FOUND IN SOURCE\n${emails.join("\n")}`);
    }
  }
  if (gh) {
    const langLine = gh.languages.length
      ? gh.languages.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(", ")
      : gh.language ?? "";
    parts.push(
      `# GITHUB ${gh.htmlUrl}\nSTARS: ${gh.stars} · FORKS: ${gh.forks} · LICENSE: ${gh.license ?? ""}\nLANGUAGES (by bytes, authoritative): ${langLine}\nDESCRIPTION: ${gh.description ?? ""}\nHOMEPAGE: ${gh.homepage ?? ""}\nTOPICS: ${gh.topics.join(", ")}\n${gh.latestRelease ? `LATEST RELEASE: ${gh.latestRelease.tag} — ${gh.latestRelease.name}\n${gh.latestRelease.body}\n` : ""}README:\n${gh.readme}`,
    );
  }
  return parts.join("\n\n---\n\n").slice(0, MAX_INPUT_CHARS);
}

const SYSTEM_PROMPT = `You produce a complete, submission-ready product profile from website + GitHub content. You are a hybrid extractor + grounded technical writer: verbatim for verifiable facts, professional inference for narrative fields.

Return ONLY valid JSON matching the schema. No prose.

TWO CATEGORIES OF FIELDS — apply the right rule to each:

CATEGORY A — VERBATIM-ONLY (never invent, empty is correct if unstated):
- name, tagline, category
- makerName, makerHandle
- websiteUrl, githubUrl, apiUrl
- revenue (never a numeric guess)
- pricingTiers.name / .price / .specs (verbatim from a pricing page or empty array)
- latestVersion (safe placeholder 'v1.0' only if truly unstated)
- pricingPartner (fall back to 'stripe' only if unstated)

CATEGORY B — GROUNDED INFERENCE ALLOWED (must never be left empty):
- overviewPitch (1500+ chars, 4-6 paragraphs)
- features (at least 3 grounded capability sentences)
- targetAudience (2-3 sentences)
- techStack (fingerprint first, then category-typical stack if thin)
- infraHosting (fingerprint first, then generic deployment model)
- securityStandards (stated compliance OR industry-standard practices)
- originStory (2-3 paragraphs, problem → product → beneficiary)
- makerThesis (1-2 paragraphs, first-principles POV)
- latestChangelog (verbatim OR 'Initial public launch — <core capability>')
- roadmapQ3, roadmapQ4 (verbatim OR one grounded next step each)
- faqs (3-6 pairs with complete answers)
- supportEmail (verbatim OR support@<domain>)
- tags (5-8 grounded tags)

FORBIDDEN IN ALL CATEGORIES — never invent:
- Numeric claims: revenue, MRR, ARR, user counts, customer counts, download counts, funding raised, valuation, dates, awards.
- Named entities: real customer names, investor names, employee names, board members.
- Specific version numbers beyond the safe 'v1.0' placeholder.
- Concrete integrations not detected/named in source.
- Compliance certifications the source doesn't claim (SOC2, ISO 27001, HIPAA, PCI-DSS are claims, not defaults).

DETECTED TECHNOLOGIES BLOCK (top of corpus, when present):
- This is the AUTHORITATIVE list of technologies fingerprinted from HTTP response headers, script tags, meta generators, cookie signatures, and (for GitHub repos) the /languages byte-count API.
- techStack and infraHosting MUST draw from this list. If a technology isn't listed here AND isn't named explicitly in page copy, do NOT include it.
- pricingPartner MUST come from the PAYMENTS entry unless the source explicitly names another provider.
- If the block is missing for a category, leave the corresponding field empty rather than guessing.

WHAT COUNTS AS "IN THE SOURCE":
- Text visible on the crawled pages, README content, release notes, meta tags, footer, or FAQ page.
- A tech stack listed on a careers/docs page IS in source.
- A tech stack that "must exist because it's a SaaS" is NOT in source.
- A pricing tier shown on the pricing page IS in source.
- A pricing tier inferred from "products in this category usually have Free/Pro/Enterprise" is NOT in source.

ANCHOR SECTIONS:
- Blocks labeled "# ANCHOR SECTION #pricing", "# ANCHOR SECTION #plans", "# ANCHOR SECTION #faq" etc. are extracted directly from same-page anchors (e.g. site.com/#pricing) and are AUTHORITATIVE for that topic.
- If a #pricing or #plans anchor is present, use it as the primary source for pricingTiers.
- If a #faq or #faqs anchor is present, use it as the primary source for faqs.

PRICING TIERS (extract verbatim):
- Only include tiers explicitly shown on a pricing/plans page in the corpus.
- price: the price string exactly as displayed ("$0", "$29/mo", "$99/user/month", "Custom", "Contact us"). Empty string if no price shown.
- specs: what's included in that tier, verbatim from source (comma-separated features/limits).
- If no pricing page is in the corpus → return an EMPTY array. Do not backfill Free/Pro/Enterprise.

FAQS:
- Extract or generate 3-6 FAQ Q&A pairs grounded in the website details.
- EVERY FAQ MUST HAVE BOTH A CLEAR QUESTION ('q') AND A DETAILED, HELPFUL ANSWER ('a') derived directly from the website's features, architecture, tech stack, pricing, and capabilities found in the corpus.
- Answers must be complete, multi-sentence explanations based on the content details. Never leave answer 'a' empty.

OVERVIEW PITCH (HARD 1500-CHAR MINIMUM):
- MUST be at least 1500 characters. Target 1800-2400. Count as you write; if under 1500, keep expanding.
- 4-6 distinct paragraphs. Separate every single paragraph with a double newline ("\n\n").
- Must sound 100% authentic, professional, and human-written. Avoid AI buzzwords, repetitive intro clichés, or corporate fluff.
- Everything must be grounded in the source — no invented facts, numbers, customers, or claims.
- To reach length: exhaustively describe each stated feature, capability, integration, target audience, use case, workflow, and differentiation the source mentions. Explain how features connect. Cover onboarding, output, and outcomes if the source describes them.
- If the source is thin, keep paraphrasing the same material with more precision and structure until you clear 1500 — do NOT invent new features to pad length.
- This is the ONLY field where length is enforced. All other fields stay strictly source-only and can be empty.

STYLE:
- Tagline: ≤100 chars, no trailing period, sourced from hero copy or meta description.
- No purple prose, no emojis, no exclamation marks.
- Paraphrase rather than copying long verbatim passages, but preserve factual specificity.
- category: pick EXACTLY ONE slug from the ALLOWED CATEGORIES list in the user message. If the request contains an enum for "category", you MUST return one of those values verbatim or an empty string. Never invent a category name. Never return a display label — only a slug from the list.`;

/**
 * Cleans and repairs malformed or truncated JSON from LLM generation.
 */
export function repairAndParseJson<T = any>(raw: string): T {
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty or non-string JSON input");
  }

  let text = raw.trim();

  // Strip markdown code fences if wrapped in ```json ... ``` or ``` ... ```
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // Sanitize literal unescaped control characters / newlines inside quotes
  const sanitized = sanitizeJsonString(text);

  // Fast path: try standard JSON.parse on sanitized text
  try {
    return JSON.parse(sanitized) as T;
  } catch {
    // Attempt state-machine repair for truncated / malformed JSON
    try {
      const repaired = repairTruncatedJson(sanitized);
      return JSON.parse(repaired) as T;
    } catch {
      // Aggressive repair fallback
      const aggressive = aggressiveJsonRepair(sanitized);
      return JSON.parse(aggressive) as T;
    }
  }
}

/**
 * Escapes literal newlines, tabs, and carriage returns inside string quotes.
 */
function sanitizeJsonString(jsonStr: string): string {
  let out = "";
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        out += ch;
      } else if (ch === "\\") {
        isEscaped = true;
        out += ch;
      } else if (ch === '"') {
        inString = false;
        out += ch;
      } else if (ch === "\n") {
        out += "\\n";
      } else if (ch === "\r") {
        out += "\\r";
      } else if (ch === "\t") {
        out += "\\t";
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') {
        inString = true;
      }
      out += ch;
    }
  }
  return out;
}

/**
 * State-machine repair for truncated JSON.
 * Fixes unclosed strings, dangling keys/colons/commas, and closes unclosed arrays/objects.
 */
function repairTruncatedJson(jsonStr: string): string {
  let s = jsonStr.trim();
  if (!s) return "{}";

  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  const firstBrace = s.indexOf("{");
  const firstBracket = s.indexOf("[");
  if (firstBrace === -1 && firstBracket === -1) return "{}";

  let startIdx = 0;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }
  s = s.slice(startIdx);

  // Check if string was left open
  let inString = false;
  let isEscaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (isEscaped) isEscaped = false;
      else if (ch === "\\") isEscaped = true;
      else if (ch === '"') inString = false;
    } else {
      if (ch === '"') inString = true;
    }
  }

  if (inString) {
    if (s.endsWith("\\") && !s.endsWith("\\\\")) s = s.slice(0, -1);
    s += '"';
  }

  function getStack(str: string): ("{" | "[")[] {
    const stack: ("{" | "[")[] = [];
    let inS = false;
    let isE = false;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (inS) {
        if (isE) isE = false;
        else if (ch === "\\") isE = true;
        else if (ch === '"') inS = false;
      } else {
        if (ch === '"') inS = true;
        else if (ch === "{") stack.push("{");
        else if (ch === "}") {
          if (stack.length && stack[stack.length - 1] === "{") stack.pop();
        } else if (ch === "[") stack.push("[");
        else if (ch === "]") {
          if (stack.length && stack[stack.length - 1] === "[") stack.pop();
        }
      }
    }
    return stack;
  }

  let cleaned = s.trim();
  while (true) {
    const prev = cleaned;
    cleaned = cleaned.replace(/,\s*$/, "").replace(/:\s*$/, "");
    const stack = getStack(cleaned);
    const top = stack[stack.length - 1];
    if (top === "{") {
      const objectDanglingKeyMatch = cleaned.match(/(?:\{|,)\s*"[^"]+"\s*$/);
      if (objectDanglingKeyMatch && typeof objectDanglingKeyMatch.index === "number") {
        cleaned = cleaned.slice(0, objectDanglingKeyMatch.index + (objectDanglingKeyMatch[0].startsWith(",") ? 0 : 1));
      }
    }
    cleaned = cleaned.replace(/,\s*$/, "");
    if (cleaned === prev) break;
  }

  const finalStack = getStack(cleaned);
  while (finalStack.length > 0) {
    const top = finalStack.pop();
    if (top === "{") cleaned += "}";
    else if (top === "[") cleaned += "]";
  }

  return cleaned;
}

function aggressiveJsonRepair(s: string): string {
  let repaired = repairTruncatedJson(s);
  const lastBrace = repaired.lastIndexOf("}");
  if (lastBrace !== -1) {
    repaired = repaired.slice(0, lastBrace + 1);
  }
  return repaired;
}

export async function extractProduct(
  inputUrl: string,
  crawl: CrawlResult | null,
  gh: GitHubRepoInfo | null,
  allowedCategories?: { slug: string; name: string }[],
): Promise<ExtractedProduct> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  // Build technology fingerprint from primary page headers + HTML, then merge in
  // GitHub /languages byte counts (authoritative for OSS repos).
  let fp: TechFingerprint = crawl?.primary?.html
    ? detectFromHtml(crawl.primary.html, crawl.primary.headers ?? {})
    : {
        languages: [],
        frameworks: [],
        libraries: [],
        cms: [],
        hosting: [],
        cdn: [],
        analytics: [],
        payments: [],
        auth: [],
        errorTracking: [],
        ecommerce: [],
        emailMarketing: [],
        observability: [],
        metaGenerator: "",
      };
  if (gh && gh.languages.length) {
    // Only include languages with ≥5% share to avoid noise (e.g. a single Dockerfile).
    fp = mergeFingerprints(fp, { languages: gh.languages.filter((l) => l.pct >= 5).map((l) => l.name) });
  }

  const corpus = buildCorpus(crawl, gh, fp);
  if (!corpus.trim()) throw new Error("No content could be fetched from the provided URL");

  // Build a per-request schema that constrains `category` to the caller's
  // allowed list (from the live database). This is what stops the LLM from
  // inventing a new category — it MUST pick one of the enum values or "".
  const schemaForRequest: JsonSchema = allowedCategories && allowedCategories.length
    ? {
        ...SCHEMA,
        properties: {
          ...(SCHEMA.properties as Record<string, unknown>),
          category: {
            type: "string",
            enum: ["", ...allowedCategories.map((c) => c.slug)],
            description:
              "Pick EXACTLY ONE slug from the enum. NEVER invent a new category. Return \"\" only if none of the enum values reasonably matches the product.",
          },
        },
      }
    : SCHEMA;

  const categoryGuidance = allowedCategories && allowedCategories.length
    ? `\n\nALLOWED CATEGORIES (choose ONE slug from this list for the "category" field; if nothing fits, return ""):\n${allowedCategories
        .map((c) => `- ${c.slug}  (${c.name})`)
        .join("\n")}\n\nHARD RULE: The "category" field MUST be either an empty string or one of the slugs above verbatim. Do NOT invent new categories or return category names — only slugs. Prefer the closest fit over an empty string when the product clearly belongs to one of these categories.`
    : "";

  const userMsg = `Source URL: ${inputUrl}${categoryGuidance}\n\nCorpus:\n${corpus}`;

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "product_extraction", schema: schemaForRequest, strict: true },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[AI Autofill] OpenAI API error (${res.status}):`, text);
    let errorMessage = `AI extraction failed (OpenAI HTTP ${res.status})`;
    try {
      const parsedError = JSON.parse(text);
      if (parsedError?.error?.message) {
        errorMessage = `AI service error: ${parsedError.error.message}`;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");

  const parsed = repairAndParseJson<Partial<ExtractedProduct>>(content);

  const ogImage = crawl?.primary?.ogImage ?? "";
  const favicon = crawl?.primary?.favicon ?? "";
  const appleTouchIcon = crawl?.primary?.appleTouchIcon ?? "";
  const socials = Array.from(new Set((crawl?.pages ?? []).flatMap((p) => p.socials)));

  // Ordered candidates for logo/thumbnail (client tries each until one converts).
  const originHost = crawl?.origin ? new URL(crawl.origin).hostname : "";
  const logoCandidates = Array.from(
    new Set(
      [
        appleTouchIcon,
        ogImage,
        favicon,
        // GitHub OG image for repos
        gh ? `https://opengraph.githubassets.com/1/${gh.owner}/${gh.name}` : "",
        // Google S2 favicon service — highest-res fallback that basically always works
        originHost ? `https://www.google.com/s2/favicons?domain=${originHost}&sz=256` : "",
        originHost ? `https://icons.duckduckgo.com/ip3/${originHost}.ico` : "",
      ].filter(Boolean),
    ),
  );

  const websiteUrl =
    parsed.websiteUrl ||
    (crawl?.origin ?? "") ||
    (gh?.homepage ?? "") ||
    inputUrl;

  const githubUrl = parsed.githubUrl || gh?.htmlUrl || socials.find((s) => /github\.com/i.test(s)) || "";

  // Ensure every FAQ entry has a complete, helpful answer derived from website content details
  const prodName = parsed.name || "This product";
  const prodCat = parsed.category || "software";

  const rawFaqs = Array.isArray(parsed.faqs) ? parsed.faqs : [];
  let faqs = rawFaqs
    .filter((f) => f && typeof f.q === "string" && f.q.trim().length > 0)
    .map((f) => ({
      q: f.q.trim(),
      a: f.a && typeof f.a === "string" && f.a.trim().length > 0 ? f.a.trim() : "",
    }));

  faqs = faqs.map((f) => {
    if (f.a && f.a.length >= 15) return f;
    const overviewSnippet = parsed.overviewPitch ? parsed.overviewPitch.slice(0, 220) + "..." : "";
    const taglineSnippet = parsed.tagline ? `${parsed.tagline}.` : "";

    if (/what is|overview|about/i.test(f.q)) {
      return {
        q: f.q,
        a: `${prodName} is a ${prodCat} platform built to ${taglineSnippet.toLowerCase()} ${overviewSnippet}`.trim(),
      };
    }
    if (/tech|stack|infra|build|framework/i.test(f.q)) {
      return {
        q: f.q,
        a: `${prodName} leverages ${parsed.techStack || "modern web frameworks"} and is deployed on ${parsed.infraHosting || "cloud infrastructure"}.`.trim(),
      };
    }
    if (/price|pricing|cost|plan|free|trial/i.test(f.q)) {
      const tierSummary = Array.isArray(parsed.pricingTiers)
        ? parsed.pricingTiers.map((t) => `${t.name} (${t.price || "Free"})`).join(", ")
        : "";
      return {
        q: f.q,
        a: tierSummary
          ? `${prodName} offers tier options including: ${tierSummary}.`
          : `${prodName} offers flexible tier options for modern teams. Check the official website for current details.`,
      };
    }
    const firstFeature = Array.isArray(parsed.features) && parsed.features[0] ? parsed.features[0] : "specialized capabilities";
    return {
      q: f.q,
      a: `${prodName} provides ${firstFeature} designed for ${parsed.targetAudience || "modern users"}. ${taglineSnippet}`.trim(),
    };
  });

  if (faqs.length === 0) {
    faqs = [
      {
        q: `What is ${prodName} and what problem does it solve?`,
        a: `${prodName} is an innovative ${prodCat} platform. ${parsed.tagline ? parsed.tagline + "." : ""} ${parsed.overviewPitch ? parsed.overviewPitch.slice(0, 220) + "..." : ""}`.trim(),
      },
      {
        q: `What are the primary capabilities and features of ${prodName}?`,
        a: Array.isArray(parsed.features) && parsed.features.length
          ? `${prodName} provides core capabilities including: ${parsed.features.slice(0, 3).join("; ")}.`
          : `${prodName} provides streamlined tools designed for ${parsed.targetAudience || "engineering and creator teams"}.`,
      },
      {
        q: `What technology stack and infrastructure power ${prodName}?`,
        a: `${prodName} is engineered with ${parsed.techStack || "modern high-performance frameworks"} and hosted on ${parsed.infraHosting || "distributed cloud infrastructure"}.`,
      },
      {
        q: `How can I get support or contact the team behind ${prodName}?`,
        a: parsed.supportEmail
          ? `For support, inquiries, or feedback, you can contact the team directly at ${parsed.supportEmail} or visit ${websiteUrl}.`
          : `For support, documentation, and developer resources, visit ${websiteUrl}.`,
      },
    ];
  }

  // Support email resolution: fallback to scraped emails or domain-derived email if model returned empty
  let supportEmail = (parsed.supportEmail || "").trim();
  const foundEmails = Array.from(new Set((crawl?.pages ?? []).flatMap((p) => p.emails ?? [])));

  if (!supportEmail && foundEmails.length > 0) {
    const preferred = foundEmails.find((e) => /^(support|contact|help|hello|info|team|sales|feedback)@/i.test(e));
    supportEmail = preferred || foundEmails[0];
  }

  if (!supportEmail && originHost) {
    const cleanHost = originHost.replace(/^www\./i, "");
    supportEmail = `support@${cleanHost}`;
  }

  const features = Array.isArray(parsed.features)
    ? parsed.features.filter((f) => typeof f === "string" && f.trim().length > 0)
    : [];

  const pricingTiers = Array.isArray(parsed.pricingTiers)
    ? parsed.pricingTiers
        .filter((t) => t && typeof t === "object")
        .map((t) => ({
          name: t.name || "",
          price: t.price || "",
          specs: t.specs || "",
        }))
    : [];

  // Guard: if an allowed-list was provided, refuse any category the model
  // hallucinated that isn't in the list. Empty string forces the user to pick.
  // The AI returns a slug; the submit form's dropdown works with display names,
  // so we map slug → display name here so the value drops straight into the field.
  const slugToName = new Map((allowedCategories || []).map((c) => [c.slug, c.name]));
  const rawCat = (parsed.category || "").trim();
  const safeCategory =
    allowedCategories && allowedCategories.length
      ? slugToName.get(rawCat) ?? ""
      : rawCat;

  return {
    name: parsed.name || "",
    tagline: parsed.tagline || "",
    category: safeCategory,
    makerName: parsed.makerName || "",
    makerHandle: parsed.makerHandle || "",
    websiteUrl,
    githubUrl,
    revenue: parsed.revenue || "",
    overviewPitch: parsed.overviewPitch || "",
    features,
    targetAudience: parsed.targetAudience || "",
    pricingTiers,
    techStack: parsed.techStack || "",
    infraHosting: parsed.infraHosting || "",
    apiUrl: parsed.apiUrl || "",
    securityStandards: parsed.securityStandards || "",
    originStory: parsed.originStory || "",
    makerThesis: parsed.makerThesis || "",
    latestVersion: parsed.latestVersion || "",
    latestChangelog: parsed.latestChangelog || "",
    roadmapQ3: parsed.roadmapQ3 || "",
    roadmapQ4: parsed.roadmapQ4 || "",
    pricingPartner: parsed.pricingPartner || "",
    faqs,
    supportEmail,
    tags: (parsed as any).tags || "",
    videoUrl: (parsed as any).videoUrl || "",
    ogImage,
    favicon,
    appleTouchIcon,
    logoCandidates,
    socials,
  };
}
