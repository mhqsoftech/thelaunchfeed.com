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
  sameAs: [
    "https://x.com/thelaunchfeed",
    "https://github.com/thelaunchfeed",
    "https://bsky.app/profile/thelaunchfeed.com",
  ],
});

export const websiteNode = () => ({
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { "@id": ORG_ID },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
});

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
