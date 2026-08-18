import { Suspense } from "react";
import type { Metadata } from "next";
import SubmitClientView from "./SubmitClientView";
import { LaunchFeedLoader } from "@/components/ui/LaunchFeedLoader";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Submit a Product - The Launch Feed",
  description:
    "Launch your software product, SaaS, or developer tool on The Launch Feed. 1-click AI autofill, 360° technical blueprints, verified MRR telemetry, and automated 6:00 AM IST releases.",
  keywords: [
    "submit product",
    "launch saas",
    "product hunt alternative",
    "software launchpad",
    "indie hacker launch",
    "developer tool submission",
    "verified mrr startup",
    "ai tool launch",
    "The Launch Feed",
  ],
  alternates: {
    canonical: `${siteUrl}/submit`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/submit`,
    title: "Submit a Product - The Launch Feed",
    description:
      "Launch your software product, SaaS, or developer tool on The Launch Feed. Complete 360° architecture blueprints and instant AI autofill.",
    siteName: "The Launch Feed",
    images: [
      {
        url: `${siteUrl}/thelaunchfeed-logo.png`,
        width: 1477,
        height: 272,
        alt: "Submit a Product - The Launch Feed",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Submit a Product - The Launch Feed",
    description:
      "Launch your software product, SaaS, or developer tool on The Launch Feed with 360° architecture intelligence.",
    images: [`${siteUrl}/thelaunchfeed-logo.png`],
    creator: "@thelaunchfeed",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function SubmitPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/submit#webpage`,
        url: `${siteUrl}/submit`,
        name: "Submit a Product — The Launch Feed",
        description:
          "Launch your software product, SaaS, or developer tool on The Launch Feed with complete 360° technical intelligence.",
        isPartOf: {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          url: siteUrl,
          name: "The Launch Feed",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Submit Product",
            item: `${siteUrl}/submit`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="sr-only">Submit Your Product Launch</h1>
      <Suspense
        fallback={
          <div className="min-h-[50vh] flex items-center justify-center p-8">
            <LaunchFeedLoader size={32} />
          </div>
        }
      >
        <SubmitClientView />
      </Suspense>
    </>
  );
}
