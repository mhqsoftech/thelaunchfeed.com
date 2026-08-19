import { NextResponse } from "next/server";
import { safeFetch } from "@/lib/ssrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4_000_000;
const TIMEOUT_MS = 6000;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon", "image/avif"]);

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const upstream = await safeFetch(raw, {
      timeoutMs: TIMEOUT_MS,
      headers: {
        "user-agent": "TheLaunchFeedBot/1.0 (+https://thelaunchfeed.com/bot)",
        accept: "image/*",
      },
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    }
    const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED.has(contentType) && !contentType.startsWith("image/")) {
      return NextResponse.json({ error: `unsupported content-type ${contentType}` }, { status: 415 });
    }
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "image too large" }, { status: 413 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "content-type": contentType || "application/octet-stream",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    const msg = err?.message || "fetch failed";
    if (msg.startsWith("ssrf:")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "fetch failed" }, { status: 504 });
  }
}
