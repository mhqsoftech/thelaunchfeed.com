import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeArchitecture } from "../../lib/architecture/detect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

  try {
    const result = await analyzeArchitecture(parsed.url);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Convenience GET for manual inspection: /api/architecture?url=example.com
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing ?url" }, { status: 400 });
  try {
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const result = await analyzeArchitecture(target);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
