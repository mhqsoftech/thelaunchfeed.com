# Markdown Negotiation

The Launch Feed serves a clean Markdown representation of its public content
pages to any client that asks for it. Agents get formatting-stripped text
instead of scraping the HTML app shell.

## How to request

Send either of these on any supported path:

- `Accept: text/markdown` (preferred; may be ranked ahead of `text/html`)
- `?format=md` query parameter (useful for tools that can't set headers)

The response is `Content-Type: text/markdown; charset=utf-8` with a
`Vary: Accept` header so intermediaries cache HTML and Markdown separately.
Browsers sending `text/html,*/*` continue to receive the full HTML app —
this feature is agent-only.

## Supported paths

Every public content route serves Markdown on request. This includes but
is not limited to:

- `/` — homepage / daily leaderboard
- `/product/{slug}` — individual product pages
- `/founder/{username}` — founder profiles
- `/category/{slug}` — category archives
- `/founders` — founders directory
- `/weekly`, `/monthly` — cycle leaderboards
- Any new page shipped in future releases — no allowlist to keep in sync.

The following routes never serve Markdown and always return their native
content type: `/api/*`, `/admin*`, `/handler*`, `/.well-known/*`, static
files (`*.png`, `*.js`, `*.woff2`, …), `robots.txt`, `sitemap.xml`,
`llms.txt`, `favicon.ico`, and site manifests.

## Example

```bash
curl -H "Accept: text/markdown" https://thelaunchfeed.com/
curl https://thelaunchfeed.com/product/example-slug?format=md
```

## Notes for crawlers

- Cache TTL: 5 minutes at the edge, `stale-while-revalidate` 1 hour.
- Content is derived from the same source of truth as the HTML page —
  nothing is hallucinated or paraphrased in the conversion step.
- Chrome (navigation, sidebars, footers, tracking) is stripped; the
  primary content block is preserved with headings, lists, and links.
- The renderer respects the site's existing rate limits. High-volume
  crawlers should stagger requests.
