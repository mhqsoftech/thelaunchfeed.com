import type { Metadata } from "next";
import Script from "next/script";
import { doto, geistSans, geistMono } from "./fonts";
import SessionBridge from "./components/SessionBridge";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://thelaunchfeed.com"),
  title: "The Launch Feed - The Daily Software & AI Product Leaderboard",
  description:
    "Discover the best new tech products, SaaS apps, AI tools, and developer software every day. Real-time community voting, verified founder MRR, and instant launch scheduling.",
  keywords: [
    "product launch",
    "saas leaderboard",
    "ai tools discovery",
    "daily tech launches",
    "indie hacker products",
    "verified mrr",
    "product hunt alternative",
    "startup launches",
    "developer tools",
    "software directory",
  ],
  authors: [{ name: "The Launch Feed" }],
  creator: "The Launch Feed",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://thelaunchfeed.com",
    siteName: "The Launch Feed",
    title: "The Launch Feed - The Daily Software & AI Product Leaderboard",
    description:
      "Discover the best new tech products, SaaS apps, and AI tools launched today. Real-time voting, verified MRR badges, and permanent maker backlinks.",
    images: [
      {
        url: "/thelaunchfeed-logo.png",
        width: 1477,
        height: 272,
        alt: "The Launch Feed - Ship. Vote. Rise.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Launch Feed - The Daily Software & AI Product Leaderboard",
    description:
      "Discover the best new tech products, SaaS apps, and AI tools launched today with verified revenue badges.",
    images: ["/thelaunchfeed-logo.png"],
    creator: "@thelaunchfeed",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  verification: {
    google: "googled2d6cb4f814366f3",
  },
};

/**
 * Theme-init script — runs synchronously before paint so the correct data-theme
 * attribute is on <html> before any paint. Reads localStorage("tlf-theme") first,
 * then falls back to the OS `prefers-color-scheme` value.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("tlf-theme");if(t!=="void"&&t!=="thermal"&&t!=="light"){t=matchMedia("(prefers-color-scheme: dark)").matches?"void":"light";}document.documentElement.setAttribute("data-theme",t);var bg=t==="void"?"#09090B":t==="thermal"?"#050B14":"#FFFFFF";var fg=t==="light"?"#0A0A0A":"#F4F4F5";var s=document.createElement("style");s.setAttribute("data-theme-preload","");s.textContent="html,body{background:"+bg+";color:"+fg+";}";document.head.appendChild(s);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${doto.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script
          id="tlf-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        {/* Google tag (gtag.js) */}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-0SNJ5D2ZK4"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-0SNJ5D2ZK4');
            `,
          }}
        />
        {/* Microsoft Clarity */}
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "y3x2emb0lf");
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-void text-ink font-mono">
        <SessionBridge />
        {children}
      </body>
    </html>
  );
}

