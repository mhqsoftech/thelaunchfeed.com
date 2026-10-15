import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { tick } from "@/lib/jobs";

/**
 * Scheduler heartbeat — replaces /api/inngest.
 *
 * Call with `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this
 * header automatically when CRON_SECRET is set). Safe to call as often as
 * you like and from several pingers at once: each scheduled slot runs once.
 *
 *   curl -X POST https://thelaunchfeed.com/api/cron -H "Authorization: Bearer $CRON_SECRET"
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "CRON_SECRET_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const source = req.headers.get("x-cron-source") || (req.headers.get("user-agent")?.includes("vercel-cron") ? "vercel-cron" : "api");
  try {
    const result = await tick(source.slice(0, 40), 50_000);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cron] tick failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export const GET = handle;
export const POST = handle;
