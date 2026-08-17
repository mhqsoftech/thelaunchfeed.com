import type { MetadataRoute } from "next";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Standard search engine crawlers (Google, Bing, Apple, DuckDuckGo, Yahoo, Yandex, Baidu)
      {
        userAgent: [
          "*",
          "Googlebot",
          "Googlebot-Image",
          "Googlebot-News",
          "Bingbot",
          "Slurp",
          "DuckDuckBot",
          "Baiduspider",
          "YandexBot",
          "Applebot",
        ],
        allow: [
          "/",
          "/product/",
          "/founder/",
          "/category/",
          "/founders",
          "/submit",
          "/about",
          "/contact",
          "/privacy",
          "/terms",
          "/llms.txt",
          "/llms-full.txt",
          "/sitemap.xml",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/handler/",
          "/login",
          "/profile",
          "/_next/",
        ],
      },
      // AI Crawlers & LLM Agents (ChatGPT, Claude, Perplexity, Gemini, Apple Intelligence, Meta, Cohere)
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "PerplexityBot",
          "Google-Extended",
          "Applebot-Extended",
          "Amazonbot",
          "FacebookBot",
          "Meta-ExternalAgent",
          "Bytespider",
          "cohere-ai",
          "Diffbot",
          "CCBot",
        ],
        allow: [
          "/",
          "/product/",
          "/founder/",
          "/category/",
          "/founders",
          "/submit",
          "/about",
          "/contact",
          "/privacy",
          "/terms",
          "/llms.txt",
          "/llms-full.txt",
          "/sitemap.xml",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/handler/",
          "/login",
          "/profile",
          "/_next/",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
