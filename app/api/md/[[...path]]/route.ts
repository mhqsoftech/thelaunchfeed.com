import { NextRequest, NextResponse } from "next/server";
import TurndownService from "turndown";

/**
 * Renders any public content page as clean Markdown for AI agents.
 *
 * Fetches the page's own HTML (forcing text/html on the upstream request so
 * the middleware doesn't loop back into this route), extracts the primary
 * content block, and hands it to Turndown. Chrome — nav, sidebars, footer,
 * inline scripts, tracking pixels — is stripped so agents get the actual
 * substance of the page instead of layout noise.
 */

export const dynamic = "force-dynamic";

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  linkStyle: "inlined",
});
// Drop assets that carry no textual signal for an agent. Cast to satisfy
// Turndown's DOM-typed signature — its filter accepts any tag name at
// runtime, but the types are pinned to HTMLElementTagNameMap so SVG /
// canvas / etc. would fail typecheck without this.
td.remove([
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "canvas",
  "video",
  "audio",
  "form",
] as unknown as (keyof HTMLElementTagNameMap)[]);

function extractMainContent(html: string): string {
  // Prefer <main>, then role="main", then <article>. Falls back to <body>
  // so we always have *something* to render.
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (main) return main;
  const role = html.match(/<[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/[a-z0-9]+>/i)?.[1];
  if (role) return role;
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (article) return article;
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  return body || html;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const targetPath = "/" + (path?.join("/") ?? "");
  const target = new URL(targetPath, req.nextUrl.origin).toString();

  let html: string;
  try {
    const upstream = await fetch(target, {
      // Force HTML from the origin — sending Accept: text/markdown here would
      // send the middleware into an infinite rewrite loop.
      headers: { accept: "text/html", "user-agent": "TheLaunchFeed-MarkdownRenderer/1.0" },
      cache: "no-store",
    });
    if (!upstream.ok) {
      return new NextResponse(`# ${upstream.status} ${upstream.statusText}\n\nUpstream did not return HTML for ${targetPath}.`, {
        status: upstream.status,
        headers: { "content-type": "text/markdown; charset=utf-8" },
      });
    }
    html = await upstream.text();
  } catch (err) {
    return new NextResponse(`# Fetch failed\n\n${err instanceof Error ? err.message : String(err)}`, {
      status: 502,
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }

  const title = extractTitle(html);
  const main = extractMainContent(html);
  const body = td.turndown(main).trim();

  const canonical = new URL(targetPath, req.nextUrl.origin).toString();
  const header = [
    title ? `# ${title}` : null,
    `> Source: ${canonical}`,
    `> Rendered as Markdown for AI agents. Request \`Accept: text/html\` to view the full site.`,
  ]
    .filter(Boolean)
    .join("\n");

  const markdown = `${header}\n\n${body}\n`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
      "vary": "Accept",
      "x-content-type-options": "nosniff",
    },
  });
}
