import { NextResponse } from "next/server";
import { assertSafeUrl } from "@/lib/ssrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8_000_000;

/**
 * Captures a 1200×630 screenshot of a given URL.
 * Cascades through multiple free screenshot providers.
 *
 * Usage: GET /api/screenshot?url=https://example.com
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  const safety = await assertSafeUrl(raw);
  if (!safety.ok) {
    return NextResponse.json({ error: safety.reason }, { status: 400 });
  }
  const target = safety.url;
  const targetUrl = target.toString();
  const TIMEOUT_MS = 20000;

  // Helper: fetch with timeout
  async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, {
        signal: ctrl.signal,
        headers: { "user-agent": "TheLaunchFeedBot/1.0 (+https://thelaunchfeed.com/bot)" },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // Helper: check if response body is an image and return it
  async function extractImage(res: Response): Promise<NextResponse | null> {
    const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (ct.startsWith("image/")) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_IMAGE_BYTES) return null;
      if (buf.byteLength > 100) {
        return new NextResponse(buf, {
          status: 200,
          headers: { "content-type": ct, "cache-control": "public, max-age=300" },
        });
      }
    }
    return null;
  }

  // ── Provider 1: thum.io (free, returns image directly, raw URL not encoded) ──
  try {
    const thumUrl = `https://image.thum.io/get/width/1200/crop/630/noanimate/${targetUrl}`;
    const res = await fetchWithTimeout(thumUrl, TIMEOUT_MS);
    if (res.ok) {
      const img = await extractImage(res);
      if (img) return img;
    }
  } catch {
    // fall through
  }

  // ── Provider 2: screenshotmachine.com free tier ──
  try {
    const ssmUrl = `https://api.screenshotmachine.com/?url=${encodeURIComponent(targetUrl)}&dimension=1200x630&format=png&cacheLimit=0&timeout=10000`;
    const res = await fetchWithTimeout(ssmUrl, TIMEOUT_MS);
    if (res.ok) {
      const img = await extractImage(res);
      if (img) return img;
    }
  } catch {
    // fall through
  }

  // ── Provider 3: Microlink (returns JSON, extract screenshot URL) ──
  try {
    const mlUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&viewport.width=1200&viewport.height=630&viewport.deviceScaleFactor=1`;
    const res = await fetchWithTimeout(mlUrl, TIMEOUT_MS);
    if (res.ok) {
      const json = await res.json();
      const screenshotUrl = json?.data?.screenshot?.url;
      // Microlink returns a CDN URL — still validate before we fetch it, so a
      // compromised or spoofed response can't turn this into an SSRF vector.
      if (screenshotUrl && (await assertSafeUrl(screenshotUrl)).ok) {
        const imgRes = await fetchWithTimeout(screenshotUrl, 10000);
        if (imgRes.ok) {
          const img = await extractImage(imgRes);
          if (img) return img;
        }
      }
    }
  } catch {
    // fall through
  }

  // ── Provider 4: Google PageSpeed thumbnail (always available) ──
  try {
    const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&category=performance&strategy=desktop&fields=lighthouseResult.audits.final-screenshot`;
    const res = await fetchWithTimeout(psUrl, TIMEOUT_MS);
    if (res.ok) {
      const json = await res.json();
      const dataUri = json?.lighthouseResult?.audits?.["final-screenshot"]?.details?.data;
      if (dataUri && typeof dataUri === "string" && dataUri.startsWith("data:image/")) {
        const base64 = dataUri.split(",")[1];
        const buf = Buffer.from(base64, "base64");
        const mime = dataUri.split(";")[0].split(":")[1] || "image/jpeg";
        return new NextResponse(buf, {
          status: 200,
          headers: { "content-type": mime, "cache-control": "public, max-age=300" },
        });
      }
    }
  } catch {
    // fall through
  }

  return NextResponse.json(
    { error: "Failed to capture screenshot. The site may be blocking automated access or all providers are unavailable." },
    { status: 502 }
  );
}
