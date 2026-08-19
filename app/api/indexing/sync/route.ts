import { NextRequest, NextResponse } from "next/server";
import { syncDeployUrls, getDailyQuotaStatus } from "@/lib/indexing";
import { authClient } from "@/lib/auth-client";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Check authorization via Bearer token or Cron Secret or Web Indexing API Key
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const cronSecret = process.env.CRON_SECRET?.trim();
    const apiKey = process.env.WEB_INDEXING_API_KEY?.trim();

    let authorized = false;

    if (cronSecret && token === cronSecret) {
      authorized = true;
    } else if (apiKey && token === apiKey) {
      authorized = true;
    } else {
      // Check admin session
      const reqHeaders = await headers();
      const session = await auth.api.getSession({ headers: reqHeaders });
      if (session?.user?.role === "ADMIN") {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const quota = await getDailyQuotaStatus();
    const summary = await syncDeployUrls(200);

    return NextResponse.json({
      success: true,
      quota,
      summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET intentionally omitted. Cron callers use bearer tokens on POST; browser
// admins go through the admin UI (also POST). Exposing GET turned this into a
// CSRF handle — any page with <img src="…/api/indexing/sync"> triggered a
// 200-URL re-submission on the signed-in admin's daily indexing quota.
export async function GET() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "POST" } });
}
