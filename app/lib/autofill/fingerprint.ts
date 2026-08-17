export type TechFingerprint = {
  languages: string[];
  frameworks: string[];
  libraries: string[];
  cms: string[];
  hosting: string[];
  cdn: string[];
  analytics: string[];
  payments: string[];
  auth: string[];
  errorTracking: string[];
  ecommerce: string[];
  emailMarketing: string[];
  observability: string[];
  metaGenerator: string;
};

const EMPTY: TechFingerprint = {
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

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

// Signature tables — each entry is { label, test: (html, headers) => boolean }.
type Sig = { label: string; test: (h: string, hd: Record<string, string>) => boolean };

const H = (name: string) => (_h: string, hd: Record<string, string>) => (hd[name.toLowerCase()] ?? "") !== "";
const HInc = (name: string, needle: string) =>
  (_h: string, hd: Record<string, string>) => {
    if (!needle) return false; // guard: empty needle would trivially match — use H() to test presence.
    const v = hd[name.toLowerCase()];
    return typeof v === "string" && v.toLowerCase().includes(needle.toLowerCase());
  };
const HTMLInc = (needle: string | RegExp) =>
  (h: string) => (typeof needle === "string" ? h.includes(needle) : needle.test(h));

// --- Frontend frameworks & meta-frameworks
const FRAMEWORK_SIGS: Sig[] = [
  { label: "Next.js", test: (h, hd) => HTMLInc("/_next/")(h) || HTMLInc(/id=["']__next["']/i)(h) || HInc("x-powered-by", "Next.js")(h, hd) },
  { label: "Nuxt", test: HTMLInc(/id=["']__nuxt["']|\/_nuxt\//i) },
  { label: "Remix", test: HTMLInc(/__remixContext|window\.__remixManifest/) },
  { label: "SvelteKit", test: HTMLInc(/data-sveltekit-|__sveltekit_/) },
  { label: "Astro", test: HTMLInc(/\/_astro\/|astro-island/) },
  { label: "Gatsby", test: HTMLInc(/id=["']___gatsby["']|\/page-data\//) },
  { label: "Angular", test: HTMLInc(/ng-version=/) },
  { label: "Vue", test: HTMLInc(/vue(\.runtime)?(\.min)?\.js|data-v-app/) },
  { label: "React", test: HTMLInc(/react(-dom)?(\.production|\.development)?(\.min)?\.js|__reactContainer/) },
  { label: "Svelte", test: HTMLInc(/svelte-[a-z0-9]{5,}/) },
  { label: "SolidJS", test: HTMLInc(/data-hk=|solid-js/) },
  { label: "Ember", test: HTMLInc(/data-ember-|ember-application/) },
  { label: "Backbone", test: HTMLInc(/backbone(\.min)?\.js/) },
  { label: "jQuery", test: HTMLInc(/jquery[-.]?\d?\.?[\d.]*(\.min)?\.js/) },
  { label: "HTMX", test: HTMLInc(/htmx\.org|hx-get|hx-post/) },
  { label: "Alpine.js", test: HTMLInc(/alpine(\.min)?\.js|x-data=/) },
];

// --- CMS / site builders
const CMS_SIGS: Sig[] = [
  { label: "WordPress", test: (h, hd) => HTMLInc(/wp-content\/|wp-includes\/|wp-json\//)(h) || HInc("link", "wp-json")(h, hd) },
  { label: "Shopify", test: (h, hd) => HTMLInc(/cdn\.shopify\.com\/s\/|window\.Shopify\s*=|Shopify\.theme\b/)(h) || H("x-shopid")(h, hd) || H("x-shopify-stage")(h, hd) },
  { label: "Wix", test: HTMLInc(/static\.wixstatic\.com|_wixCIDX/) },
  { label: "Squarespace", test: HTMLInc(/static1\.squarespace\.com|Static\.SQUARESPACE_CONTEXT/) },
  { label: "Webflow", test: (h, hd) => HTMLInc(/webflow\.js|assets-global\.website-files\.com|data-wf-page/)(h) || H("x-wf-page-id")(h, hd) },
  { label: "Framer", test: HTMLInc(/framerusercontent\.com|framer\.com/) },
  { label: "Ghost", test: HTMLInc(/name=["']generator["'][^>]*content=["']Ghost\b/i) },
  { label: "Contentful", test: HTMLInc(/images\.ctfassets\.net/) },
  { label: "Sanity", test: HTMLInc(/cdn\.sanity\.io/) },
  { label: "Drupal", test: HTMLInc(/drupal\.js|sites\/all\/|sites\/default\//) },
  { label: "Joomla", test: HTMLInc(/\/media\/jui\/|\/media\/system\/js\//) },
  { label: "HubSpot CMS", test: HTMLInc(/hs-scripts\.com|hubspot\.com\/cs\//) },
  { label: "Notion", test: HTMLInc(/notion\.so|super\.so/) },
  { label: "Cargo", test: HTMLInc(/freight\.cargo\.site/) },
];

// --- Hosting / edge / CDN
const HOSTING_SIGS: Sig[] = [
  { label: "Vercel", test: (h, hd) => H("x-vercel-id")(h, hd) || HInc("server", "Vercel")(h, hd) || H("x-vercel-cache")(h, hd) },
  { label: "Netlify", test: (h, hd) => HInc("server", "Netlify")(h, hd) || H("x-nf-request-id")(h, hd) },
  { label: "Cloudflare Pages", test: (h, hd) => H("cf-ray")(h, hd) && HInc("server", "cloudflare")(h, hd) && H("cf-worker")(h, hd) },
  { label: "Cloudflare", test: (h, hd) => H("cf-ray")(h, hd) || HInc("server", "cloudflare")(h, hd) },
  { label: "GitHub Pages", test: (h, hd) => HInc("server", "GitHub.com")(h, hd) || H("x-github-request-id")(h, hd) },
  { label: "AWS CloudFront", test: (h, hd) => HInc("via", "CloudFront")(h, hd) || H("x-amz-cf-id")(h, hd) },
  { label: "AWS S3", test: (h, hd) => HInc("server", "AmazonS3")(h, hd) },
  { label: "Fly.io", test: (h, hd) => H("fly-request-id")(h, hd) },
  { label: "Render", test: (h, hd) => HInc("server", "Render")(h, hd) || H("rndr-id")(h, hd) },
  { label: "Railway", test: (h, hd) => H("x-railway-request-id")(h, hd) },
  { label: "Heroku", test: (h, hd) => H("via")(h, hd) && HInc("via", "vegur")(h, hd) },
  { label: "Fastly", test: (h, hd) => H("x-served-by")(h, hd) || HInc("via", "varnish")(h, hd) },
  { label: "Akamai", test: (h, hd) => HInc("server", "AkamaiGHost")(h, hd) || H("x-akamai-request-id")(h, hd) },
  { label: "Google Cloud", test: (h, hd) => HInc("server", "Google Frontend")(h, hd) || HInc("via", "google")(h, hd) },
  { label: "Firebase Hosting", test: (h, hd) => HInc("x-served-by", "firebase")(h, hd) },
  { label: "Bunny.net", test: (h, hd) => HInc("server", "BunnyCDN")(h, hd) },
];

// --- Backend / language hints (from headers + inline)
const LANGUAGE_SIGS: Sig[] = [
  { label: "Node.js", test: (h, hd) => HInc("x-powered-by", "Express")(h, hd) || HInc("x-powered-by", "Nest")(h, hd) },
  { label: "PHP", test: (h, hd) => HInc("x-powered-by", "PHP")(h, hd) || HInc("set-cookie", "PHPSESSID")(h, hd) },
  { label: "Ruby", test: (h, hd) => HInc("x-powered-by", "Phusion")(h, hd) || HInc("set-cookie", "_session_id")(h, hd) || HInc("server", "Puma")(h, hd) },
  { label: "Python", test: (h, hd) => HInc("server", "gunicorn")(h, hd) || HInc("server", "WSGIServer")(h, hd) || HInc("set-cookie", "csrftoken")(h, hd) || HInc("set-cookie", "sessionid")(h, hd) },
  { label: "Java", test: (h, hd) => HInc("x-powered-by", "Servlet")(h, hd) || HInc("server", "Tomcat")(h, hd) || HInc("server", "Jetty")(h, hd) },
  { label: "Go", test: (h, hd) => HInc("server", "Golang")(h, hd) },
  { label: "Rust", test: (h, hd) => HInc("server", "actix")(h, hd) || HInc("server", "hyper")(h, hd) },
  { label: ".NET", test: (h, hd) => HInc("x-powered-by", "ASP.NET")(h, hd) || H("x-aspnet-version")(h, hd) },
];

// --- Analytics
const ANALYTICS_SIGS: Sig[] = [
  { label: "Google Analytics", test: HTMLInc(/googletagmanager\.com\/gtag\/js|google-analytics\.com\/ga\.js|gtag\(/) },
  { label: "Google Tag Manager", test: HTMLInc(/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/) },
  { label: "Plausible", test: HTMLInc(/plausible\.io\/js\//) },
  { label: "Fathom", test: HTMLInc(/cdn\.usefathom\.com/) },
  { label: "Umami", test: HTMLInc(/umami\.(is|js)|analytics\.umami\.is/) },
  { label: "Simple Analytics", test: HTMLInc(/scripts\.simpleanalyticscdn\.com/) },
  { label: "Mixpanel", test: HTMLInc(/cdn\.mxpnl\.com|mixpanel\.init/) },
  { label: "Amplitude", test: HTMLInc(/cdn\.amplitude\.com|amplitude\.init/) },
  { label: "Segment", test: HTMLInc(/cdn\.segment\.com\/analytics\.js/) },
  { label: "PostHog", test: HTMLInc(/posthog\.com|posthog\.init/) },
  { label: "Heap", test: HTMLInc(/cdn\.heapanalytics\.com/) },
  { label: "Hotjar", test: HTMLInc(/static\.hotjar\.com/) },
  { label: "FullStory", test: HTMLInc(/edge\.fullstory\.com|fs\.identify/) },
  { label: "LogRocket", test: HTMLInc(/cdn\.lr-ingest\.io|logrocket\.init/) },
  { label: "Vercel Analytics", test: HTMLInc(/_vercel\/insights/) },
  { label: "Cloudflare Web Analytics", test: HTMLInc(/static\.cloudflareinsights\.com/) },
];

// --- Payments
const PAYMENT_SIGS: Sig[] = [
  { label: "Stripe", test: HTMLInc(/js\.stripe\.com|checkout\.stripe\.com|stripe\.buy\/|billing\.stripe\.com/) },
  { label: "Paddle", test: HTMLInc(/cdn\.paddle\.com|paddle_button/) },
  { label: "Lemon Squeezy", test: HTMLInc(/lemonsqueezy\.com/) },
  { label: "Polar", test: HTMLInc(/polar\.sh/) },
  { label: "RevenueCat", test: HTMLInc(/revenuecat\.com/) },
  { label: "Chargebee", test: HTMLInc(/js\.chargebee\.com|chargebee\.com\/hostedpages/) },
  { label: "PayPal", test: HTMLInc(/paypal\.com\/sdk\/js|paypalobjects\.com/) },
  { label: "Braintree", test: HTMLInc(/js\.braintreegateway\.com/) },
  { label: "Square", test: HTMLInc(/js\.squareup\.com|sq-payment/) },
  { label: "Gumroad", test: HTMLInc(/gumroad\.com\/js|gumroad-overlay/) },
];

// --- Auth
const AUTH_SIGS: Sig[] = [
  { label: "Auth0", test: HTMLInc(/cdn\.auth0\.com|auth0\.com\/authorize/) },
  { label: "Clerk", test: HTMLInc(/clerk\.com|clerk\.accounts\./) },
  { label: "Firebase Auth", test: HTMLInc(/firebaseauth\.com|apis\.google\.com\/js\/api\.js/) },
  { label: "Supabase Auth", test: HTMLInc(/supabase\.co\/auth\/v1/) },
  { label: "WorkOS", test: HTMLInc(/workos\.com/) },
  { label: "Okta", test: HTMLInc(/okta\.com|oktapreview\.com/) },
];

// --- Error tracking / observability
const ERROR_SIGS: Sig[] = [
  { label: "Sentry", test: HTMLInc(/browser\.sentry-cdn\.com|Sentry\.init/) },
  { label: "Bugsnag", test: HTMLInc(/d2wy8f7a9ursnm\.cloudfront\.net|bugsnag\.com/) },
  { label: "Rollbar", test: HTMLInc(/cdn\.rollbar\.com/) },
  { label: "Datadog", test: HTMLInc(/datadoghq-browser-agent|datadog-rum/) },
  { label: "New Relic", test: HTMLInc(/js-agent\.newrelic\.com|NREUM/) },
  { label: "Honeybadger", test: HTMLInc(/js\.honeybadger\.io/) },
];

// --- E-commerce / booking
const ECOM_SIGS: Sig[] = [
  { label: "Shopify", test: HTMLInc(/cdn\.shopify\.com|Shopify\.theme/) },
  { label: "WooCommerce", test: HTMLInc(/wc-blocks|woocommerce/) },
  { label: "BigCommerce", test: HTMLInc(/bigcommerce\.com/) },
  { label: "Snipcart", test: HTMLInc(/cdn\.snipcart\.com/) },
  { label: "Calendly", test: HTMLInc(/calendly\.com\/assets/) },
  { label: "Cal.com", test: HTMLInc(/cal\.com\/embed/) },
];

// --- Email marketing / CRM
const EMAIL_SIGS: Sig[] = [
  { label: "Mailchimp", test: HTMLInc(/chimpstatic\.com|list-manage\.com/) },
  { label: "ConvertKit", test: HTMLInc(/convertkit\.com|ck-form/) },
  { label: "Klaviyo", test: HTMLInc(/klaviyo\.com|_learnq/) },
  { label: "HubSpot", test: HTMLInc(/hs-scripts\.com|hubspot\.com\/analytics/) },
  { label: "Intercom", test: HTMLInc(/widget\.intercom\.io|Intercom\(/) },
  { label: "Drift", test: HTMLInc(/js\.driftt\.com|drift\.load/) },
  { label: "Crisp", test: HTMLInc(/client\.crisp\.chat/) },
  { label: "Beehiiv", test: HTMLInc(/beehiiv\.com/) },
  { label: "Substack", test: HTMLInc(/substackcdn\.com|substack\.com\/embed/) },
];

// --- Observability / feature flags
const OBS_SIGS: Sig[] = [
  { label: "LaunchDarkly", test: HTMLInc(/ldclient\.js|launchdarkly\.com/) },
  { label: "Statsig", test: HTMLInc(/statsigcdn\.com/) },
  { label: "GrowthBook", test: HTMLInc(/growthbook\.io/) },
  { label: "Optimizely", test: HTMLInc(/cdn\.optimizely\.com/) },
];

function runSigs(sigs: Sig[], html: string, hd: Record<string, string>): string[] {
  return uniq(sigs.filter((s) => s.test(html, hd)).map((s) => s.label));
}

function extractMetaGenerator(html: string): string {
  const m = html.match(/<meta[^>]*\bname=["']generator["'][^>]*\bcontent=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']generator["']/i);
  return m?.[1]?.trim() ?? "";
}

export function detectFromHtml(html: string, headers: Record<string, string>): TechFingerprint {
  if (!html) return { ...EMPTY };
  const frameworks = runSigs(FRAMEWORK_SIGS, html, headers);
  const cms = runSigs(CMS_SIGS, html, headers);
  const hosting = runSigs(HOSTING_SIGS, html, headers);
  const analytics = runSigs(ANALYTICS_SIGS, html, headers);
  const payments = runSigs(PAYMENT_SIGS, html, headers);
  const auth = runSigs(AUTH_SIGS, html, headers);
  const errorTracking = runSigs(ERROR_SIGS, html, headers);
  const ecommerce = runSigs(ECOM_SIGS, html, headers);
  const emailMarketing = runSigs(EMAIL_SIGS, html, headers);
  const observability = runSigs(OBS_SIGS, html, headers);
  const languages = runSigs(LANGUAGE_SIGS, html, headers);
  const metaGenerator = extractMetaGenerator(html);

  // If meta generator names a known framework, add it.
  if (metaGenerator) {
    const g = metaGenerator.toLowerCase();
    if (g.includes("hugo") && !frameworks.includes("Hugo")) frameworks.push("Hugo");
    if (g.includes("jekyll") && !frameworks.includes("Jekyll")) frameworks.push("Jekyll");
    if (g.includes("gatsby") && !frameworks.includes("Gatsby")) frameworks.push("Gatsby");
    if (g.includes("next") && !frameworks.includes("Next.js")) frameworks.push("Next.js");
    if (g.includes("nuxt") && !frameworks.includes("Nuxt")) frameworks.push("Nuxt");
    if (g.includes("wordpress") && !cms.includes("WordPress")) cms.push("WordPress");
    if (g.includes("drupal") && !cms.includes("Drupal")) cms.push("Drupal");
  }

  // CDN is a subset of hosting for reporting purposes.
  const cdnSet = new Set(["Cloudflare", "AWS CloudFront", "Fastly", "Akamai", "Bunny.net"]);
  const cdn = hosting.filter((h) => cdnSet.has(h));

  return {
    languages,
    frameworks,
    libraries: [],
    cms,
    hosting: hosting.filter((h) => !cdnSet.has(h)),
    cdn,
    analytics,
    payments,
    auth,
    errorTracking,
    ecommerce,
    emailMarketing,
    observability,
    metaGenerator,
  };
}

/**
 * Merge a secondary fingerprint (e.g. from GitHub /languages) into a primary one.
 * GitHub languages are byte-count-authoritative for OSS repos.
 */
export function mergeFingerprints(a: TechFingerprint, b: Partial<TechFingerprint>): TechFingerprint {
  const out: TechFingerprint = { ...a };
  (Object.keys(b) as (keyof TechFingerprint)[]).forEach((k) => {
    const bv = b[k];
    if (Array.isArray(bv) && Array.isArray(out[k])) {
      (out[k] as string[]) = uniq([...(out[k] as string[]), ...bv]);
    } else if (typeof bv === "string" && bv) {
      (out[k] as string) = bv;
    }
  });
  return out;
}

export function fingerprintSummary(fp: TechFingerprint): string {
  const parts: string[] = [];
  if (fp.languages.length) parts.push(`LANGUAGES: ${fp.languages.join(", ")}`);
  if (fp.frameworks.length) parts.push(`FRAMEWORKS: ${fp.frameworks.join(", ")}`);
  if (fp.cms.length) parts.push(`CMS: ${fp.cms.join(", ")}`);
  if (fp.hosting.length) parts.push(`HOSTING: ${fp.hosting.join(", ")}`);
  if (fp.cdn.length) parts.push(`CDN: ${fp.cdn.join(", ")}`);
  if (fp.analytics.length) parts.push(`ANALYTICS: ${fp.analytics.join(", ")}`);
  if (fp.payments.length) parts.push(`PAYMENTS: ${fp.payments.join(", ")}`);
  if (fp.auth.length) parts.push(`AUTH: ${fp.auth.join(", ")}`);
  if (fp.errorTracking.length) parts.push(`ERROR TRACKING: ${fp.errorTracking.join(", ")}`);
  if (fp.ecommerce.length) parts.push(`E-COMMERCE: ${fp.ecommerce.join(", ")}`);
  if (fp.emailMarketing.length) parts.push(`EMAIL / SUPPORT: ${fp.emailMarketing.join(", ")}`);
  if (fp.observability.length) parts.push(`FEATURE FLAGS: ${fp.observability.join(", ")}`);
  if (fp.metaGenerator) parts.push(`META GENERATOR: ${fp.metaGenerator}`);
  return parts.join("\n");
}
