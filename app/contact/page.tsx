import type { Metadata } from "next";
import MainLayoutShell from "@/app/MainLayoutShell";
import ContactClientView from "./ContactClientView";
import { breadcrumb, webPageNode } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "Contact - The Launch Feed",
  description:
    "Contact The Launch Feed team for product launch inquiries, featured sponsorships, developer support, or bug reports.",
  alternates: {
    canonical: "https://thelaunchfeed.com/contact",
  },
  openGraph: {
    title: "Contact - The Launch Feed",
    description:
      "Contact The Launch Feed team for product launch inquiries, featured sponsorships, or developer support.",
    type: "website",
    url: "https://thelaunchfeed.com/contact",
    siteName: "The Launch Feed",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact - The Launch Feed",
    description:
      "Contact The Launch Feed team for product launch inquiries, featured sponsorships, or developer support.",
    creator: "@thelaunchfeed",
  },
};

export default function ContactPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      webPageNode({ path: "/contact", name: "Contact The Launch Feed", description: metadata.description ?? undefined, type: "ContactPage" }),
      {
        ...breadcrumb([
          { name: "Home", url: siteUrl },
          { name: "Contact", url: `${siteUrl}/contact` },
        ]),
        "@id": `${siteUrl}/contact#breadcrumb`,
      },
    ],
  };

  return (
    <MainLayoutShell rails={false}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ContactClientView />
    </MainLayoutShell>
  );
}
