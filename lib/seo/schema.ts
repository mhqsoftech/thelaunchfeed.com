export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com"
).replace(/\/+$/, "");

export const SITE_NAME = "The Launch Feed";

export const ORG_ID = `${SITE_URL}#organization`;
export const WEBSITE_ID = `${SITE_URL}#website`;

export const organizationNode = () => ({
  "@type": "Organization",
  "@id": ORG_ID,
  name: SITE_NAME,
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/thelaunchfeed-logo.png`,
    width: 1477,
    height: 272,
  },
  description:
    "A free daily launch board where makers launch software, SaaS and AI products and the community upvotes them.",
  founder: {
    "@type": "Person",
    name: "Menajul Hoque",
    sameAs: ["https://x.com/menajulm"],
  },
  // Only profiles that exist: github.com/thelaunchfeed 404s and the Bluesky
  // handle is thelaunchfeed.bsky.social (no custom-domain handle).
  sameAs: [
    "https://x.com/thelaunchfeed",
    "https://bsky.app/profile/thelaunchfeed.bsky.social",
    "https://t.me/thelaunchfeed",
  ],
});

export const websiteNode = () => ({
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_NAME,
  url: SITE_URL,
  description:
    "The free daily leaderboard for new software, SaaS and AI products. Makers launch at 6:00 AM IST, the community votes, and the best launches rank daily, weekly, monthly and yearly.",
  inLanguage: "en",
  publisher: { "@id": ORG_ID },
});

/**
 * The page node for a route. Site-wide Organization / WebSite nodes are
 * emitted once by the root layout, so pages reference them by @id instead
 * of repeating them.
 */
export const webPageNode = (opts: {
  path: string;
  name: string;
  description?: string;
  type?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage" | "ProfilePage" | "ItemPage";
  /** Defaults to the route's generated /opengraph-image. */
  image?: string;
  breadcrumb?: boolean;
}) => {
  const url = `${SITE_URL}${opts.path === "/" ? "" : opts.path}`;
  return {
    "@type": opts.type || "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    inLanguage: "en",
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORG_ID },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: opts.image || `${url}/opengraph-image`,
      width: 1200,
      height: 630,
    },
    ...(opts.breadcrumb === false ? {} : { breadcrumb: { "@id": `${url}#breadcrumb` } }),
  };
};

export const breadcrumb = (
  trail: Array<{ name: string; url: string }>
) => ({
  "@type": "BreadcrumbList",
  itemListElement: trail.map((t, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: t.name,
    item: t.url,
  })),
});
