import { NextResponse } from "next/server";
import { z } from "zod";
import { crawlSite } from "../../lib/autofill/crawler";
import { fetchGitHub, isGitHubUrl } from "../../lib/autofill/github";
import { extractProduct } from "../../lib/autofill/extractor";
import { listCategories } from "../../actions/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .transform((s) => (s.match(/^https?:\/\//i) ? s : `https://${s}`))
    .pipe(z.url()),
});

export async function POST(req: Request) {
  let parsed;
  try {
    const body = await req.json();
    parsed = BodySchema.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const url = parsed.url;
  const gitHubFirst = isGitHubUrl(url);

  try {
    const [crawl, gh] = await Promise.all([
      gitHubFirst ? Promise.resolve(null) : crawlSite(url).catch(() => null),
      gitHubFirst ? fetchGitHub(url) : Promise.resolve(null),
    ]);

    // If input was website but a GitHub link was discovered, fetch it too.
    let ghExtra = gh;
    if (!ghExtra && crawl) {
      const ghLink = crawl.pages.flatMap((p) => p.socials).find((s) => /github\.com\/[^/]+\/[^/?#]+/.test(s));
      if (ghLink) ghExtra = await fetchGitHub(ghLink).catch(() => null);
    }

    // If GitHub-first and repo has a homepage, crawl it too for richer context.
    let crawlExtra = crawl;
    if (!crawlExtra && ghExtra?.homepage) {
      crawlExtra = await crawlSite(ghExtra.homepage).catch(() => null);
    }

    if (!crawlExtra && !ghExtra) {
      return NextResponse.json(
        { error: "Could not fetch any content from that URL (site may block bots or be down)" },
        { status: 422 },
      );
    }

    if (crawlExtra && crawlExtra.robotsAllowed === false && !ghExtra) {
      return NextResponse.json(
        { error: "This site's robots.txt disallows crawling" },
        { status: 403 },
      );
    }

    // Load the live category list so the AI is forced to pick one of them
    // rather than inventing (or freely creating) a new category.
    const cats = await listCategories()
      .then((rows) => rows.map((r) => ({ slug: r.slug, name: r.name })))
      .catch(() => [] as { slug: string; name: string }[]);

    const extracted = await extractProduct(url, crawlExtra, ghExtra, cats);

    return NextResponse.json({
      ok: true,
      data: extracted,
      meta: {
        pagesCrawled: crawlExtra?.pages.length ?? 0,
        githubStars: ghExtra?.stars ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
