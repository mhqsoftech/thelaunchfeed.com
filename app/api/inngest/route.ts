import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { functions } from "@/lib/inngest/functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  serveHost: process.env.INNGEST_SERVE_HOST || process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com",
  servePath: "/api/inngest",
});
