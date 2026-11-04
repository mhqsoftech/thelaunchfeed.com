import { Suspense } from "react";
import type { Metadata } from "next";
import SubmitClientView from "./SubmitClientView";
import { LaunchFeedLoader } from "@/components/ui/LaunchFeedLoader";
import { FaqSection } from "@/components/seo/LandingParts";
import { SITE_URL, breadcrumb, webPageNode } from "@/lib/seo/schema";
import { FAQ_BACKLINK, FAQ_IS_FREE, FAQ_LAUNCH_TIME, FAQ_PAID, FAQ_WHAT_TO_LAUNCH, faqPageNode } from "@/lib/seo/facts";

const SUBMIT_FAQS = [FAQ_IS_FREE, FAQ_LAUNCH_TIME, FAQ_WHAT_TO_LAUNCH, FAQ_BACKLINK, FAQ_PAID];

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Submit Your Startup, SaaS or AI Tool Free | The Launch Feed",
  description:
    "Submit your startup, SaaS or AI tool and launch it free at 6:00 AM IST. Paste your URL to autofill the listing, pick a launch day, and get a permanent product page.",
  keywords: [
    "submit startup",
    "submit ai tool",
    "launch saas",
    "free product launch",
    "product hunt alternative",
    "submit product",
    "indie hacker launch",
    "The Launch Feed",
  ],
  alternates: {
    canonical: "/submit",
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/submit`,
    title: "Submit Your Startup, SaaS or AI Tool Free | The Launch Feed",
    description:
      "Launch free at 6:00 AM IST. Paste your URL to autofill the listing, pick a launch day, and get a permanent product page.",
    siteName: "The Launch Feed",
  },
  twitter: {
    card: "summary_large_image",
    title: "Submit Your Startup, SaaS or AI Tool Free | The Launch Feed",
    description:
      "Launch free at 6:00 AM IST and get a permanent product page with a link to your site.",
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
      webPageNode({ path: "/submit", name: "Submit your product to The Launch Feed", description: metadata.description ?? undefined }),
      {
        ...breadcrumb([
          { name: "Home", url: SITE_URL },
          { name: "Submit product", url: `${SITE_URL}/submit` },
        ]),
        "@id": `${SITE_URL}/submit#breadcrumb`,
      },
      faqPageNode(`${SITE_URL}/submit`, SUBMIT_FAQS),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense
        fallback={
          <div className="min-h-[50vh] flex items-center justify-center p-8">
            <LaunchFeedLoader size={32} />
          </div>
        }
      >
        <SubmitClientView footer={<FaqSection faqs={SUBMIT_FAQS} heading="Questions about launching" />} />
      </Suspense>
    </>
  );
}
