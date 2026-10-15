import { getNeonStorageUrl } from "@/lib/storage-url";

/**
 * Client-safe metadata for the supported payment providers: how to create a
 * READ-ONLY key, what it looks like, and where to get it.
 *
 * All verification happens server-side in lib/revenue (live-mode only, fails
 * closed). Nothing in this file talks to a provider or handles a secret.
 */

export interface RevenueProviderConfig {
  id: string;
  name: string;
  /** What the credential looks like (shown as a hint). */
  keyPrefix: string;
  placeholder: string;
  docUrl: string;
  /** How we connect — shown in the UI instead of an imaginary SDK version. */
  sdkName: string;
  sampleKey: string;
  currency: string;
  /** Exact permissions to grant, in the provider's own words. */
  description: string;
}

export const REVENUE_PROVIDERS: RevenueProviderConfig[] = [
  {
    id: "stripe",
    name: "Stripe",
    keyPrefix: "rk_live_",
    placeholder: "rk_live_…",
    docUrl: "https://dashboard.stripe.com/apikeys/create",
    sdkName: "Stripe REST API · read-only",
    sampleKey: "",
    currency: "Any (converted to USD)",
    description: "Create a RESTRICTED key with Read access to Subscriptions and Charges only. Test keys are rejected.",
  },
  {
    id: "paddle",
    name: "Paddle Billing",
    keyPrefix: "pdl_live_apikey_",
    placeholder: "pdl_live_apikey_…",
    docUrl: "https://vendors.paddle.com/authentication-v2",
    sdkName: "Paddle Billing API · read-only",
    sampleKey: "",
    currency: "Any (converted to USD)",
    description: "Create an API key with Read permission for Subscriptions and Transactions. Sandbox keys are rejected.",
  },
  {
    id: "lemonsqueezy",
    name: "Lemon Squeezy",
    keyPrefix: "eyJ",
    placeholder: "eyJ0eXAiOiJKV1Qi…",
    docUrl: "https://app.lemonsqueezy.com/settings/api",
    sdkName: "Lemon Squeezy API · read-only",
    sampleKey: "",
    currency: "Store currency (converted to USD)",
    description: "Create a live-mode API key (Settings → API). We only read subscriptions, prices and orders. Test-mode keys are rejected.",
  },
  {
    id: "polar",
    name: "Polar",
    keyPrefix: "polar_oat_",
    placeholder: "polar_oat_…",
    docUrl: "https://polar.sh/dashboard",
    sdkName: "Polar API · read-only",
    sampleKey: "",
    currency: "Any (converted to USD)",
    description: "Create an Organization Access Token with subscriptions:read and orders:read scopes only.",
  },
  {
    id: "dodopayments",
    name: "Dodo Payments",
    keyPrefix: "",
    placeholder: "Live-mode API key",
    docUrl: "https://app.dodopayments.com/developer/api-keys",
    sdkName: "Dodo Payments API · read-only",
    sampleKey: "",
    currency: "Any (converted to USD)",
    description: "Create a LIVE-mode API key. We only read subscriptions and payments. Test-mode keys are rejected.",
  },
  {
    id: "razorpay",
    name: "Razorpay",
    keyPrefix: "rzp_live_",
    placeholder: "rzp_live_xxxx:your_key_secret",
    docUrl: "https://dashboard.razorpay.com/app/website-app-settings/api-keys",
    sdkName: "Razorpay API",
    sampleKey: "",
    currency: "INR & others (converted to USD)",
    description: "Paste LIVE key_id and key_secret joined by a colon. Razorpay keys can't be scoped read-only, so consider a dedicated key you can revoke anytime.",
  },
  {
    id: "paystack",
    name: "Paystack",
    keyPrefix: "sk_live_",
    placeholder: "sk_live_…",
    docUrl: "https://dashboard.paystack.com/#/settings/developers",
    sdkName: "Paystack API",
    sampleKey: "",
    currency: "NGN, GHS, KES, ZAR, USD (converted to USD)",
    description: "Live secret key. Paystack keys can't be scoped read-only — we only call read endpoints, and you can roll the key anytime.",
  },
  {
    id: "chargebee",
    name: "Chargebee",
    keyPrefix: "site:",
    placeholder: "yoursite:live_…",
    docUrl: "https://www.chargebee.com/docs/2.0/api_keys.html",
    sdkName: "Chargebee API v2 · read-only",
    sampleKey: "",
    currency: "Any (converted to USD)",
    description: "Create a Read-Only API key and paste it as yoursite:key (site = the subdomain of yoursite.chargebee.com). Test sites are rejected.",
  },
  {
    id: "revenuecat",
    name: "RevenueCat",
    keyPrefix: "sk_",
    placeholder: "sk_…",
    docUrl: "https://app.revenuecat.com/",
    sdkName: "RevenueCat API v2 · read-only",
    sampleKey: "",
    currency: "USD",
    description: "Create a v2 SECRET key with read-only access to Project configuration and Metrics. Uses RevenueCat's own production MRR.",
  },
  {
    id: "gumroad",
    name: "Gumroad",
    keyPrefix: "",
    placeholder: "Application access token",
    docUrl: "https://app.gumroad.com/settings/advanced#application-form",
    sdkName: "Gumroad API v2",
    sampleKey: "",
    currency: "USD",
    description: "Create an application and generate an access token (view_sales scope). MRR = recurring charges in the last 30 days.",
  },
  {
    id: "fastspring",
    name: "FastSpring",
    keyPrefix: "username:",
    placeholder: "API_USERNAME:API_PASSWORD",
    docUrl: "https://developer.fastspring.com/reference/getting-started-with-your-api",
    sdkName: "FastSpring API",
    sampleKey: "",
    currency: "Any (converted to USD)",
    description: "Paste live-store API credentials as username:password. Test subscriptions are rejected.",
  },
  {
    id: "square",
    name: "Square",
    keyPrefix: "EAAA",
    placeholder: "EAAA… (production access token)",
    docUrl: "https://developer.squareup.com/apps",
    sdkName: "Square API · read-only",
    sampleKey: "",
    currency: "Any (converted to USD)",
    description: "Production access token with SUBSCRIPTIONS_READ, ITEMS_READ and PAYMENTS_READ. Sandbox tokens are rejected.",
  },
  {
    id: "creem",
    name: "Creem",
    keyPrefix: "creem_",
    placeholder: "creem_…",
    docUrl: "https://www.creem.io/dashboard/developers",
    sdkName: "Creem API",
    sampleKey: "",
    currency: "Any (converted to USD)",
    description: "Live API key (test keys are rejected). MRR = subscription payments collected in the last 30 days.",
  },
];

/** Resolve a provider from an id or display name; null when unknown (never a silent default). */
export function findRevenueProvider(idOrName: string | null | undefined): RevenueProviderConfig | null {
  const q = (idOrName || "").trim().toLowerCase();
  if (!q) return null;
  return (
    REVENUE_PROVIDERS.find((p) => p.id === q || p.name.toLowerCase() === q) ??
    REVENUE_PROVIDERS.find((p) => q.replace(/[^a-z]/g, "").startsWith(p.id.slice(0, 5))) ??
    null
  );
}

export function PaymentProviderLogo({ id, className = "w-4 h-4" }: { id: string; className?: string }) {
  const logoId = id?.toLowerCase() || "stripe";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      width="64"
      height="64"
      src={getNeonStorageUrl(`logos/providers/${logoId}.avif`)}
      alt={`${id} logo`}
      className={`${className} object-contain shrink-0`}
      onError={(e) => {
        (e.target as HTMLImageElement).src = getNeonStorageUrl("logos/providers/stripe.avif");
      }}
    />
  );
}
