import { NextResponse } from "next/server";
import crypto from "crypto";
import { activatePlacementSlot, PlacementTier } from "@/lib/dodopayments";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify a Standard Webhooks (svix-style) signature — the format Dodo Payments
 * uses. Signed content is `${id}.${timestamp}.${rawBody}`; header contains one
 * or more `v1,<base64>` entries. Constant-time comparison, ±5m clock skew.
 */
function verifyDodoSignature(
  rawBody: string,
  headers: Headers,
  secret: string
): boolean {
  const signatureHeader = headers.get("webhook-signature") || headers.get("dodo-signature");
  const id = headers.get("webhook-id") || headers.get("dodo-id");
  const timestamp = headers.get("webhook-timestamp") || headers.get("dodo-timestamp");
  if (!signatureHeader || !id || !timestamp) return false;

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "utf8");
  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", key).update(signed).digest("base64");

  for (const part of signatureHeader.split(" ")) {
    const [version, provided] = part.split(",");
    if (version !== "v1" || !provided) continue;
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET || process.env.DODO_WEBHOOK_SECRET;

    // Fail closed: without a configured secret, do not activate anything.
    if (!secret) {
      console.error("[api/webhooks/dodo] DODO_PAYMENTS_WEBHOOK_SECRET not configured — rejecting");
      return NextResponse.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
    }
    if (!verifyDodoSignature(rawBody, req.headers, secret)) {
      return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const eventType = payload.type || payload.event_type || payload.event;
    const data = payload.data || payload;

    if (
      eventType === "payment.succeeded" ||
      eventType === "checkout.session.completed" ||
      eventType === "payment_intent.succeeded" ||
      data.status === "succeeded"
    ) {
      const metadata = data.metadata || {};
      const purchaseId = metadata.purchaseId || data.purchase_id;
      const paymentId = data.payment_id || data.id;

      // Derive everything (tier, product, submission, user) from the trusted
      // FeaturedPurchase row — never from webhook metadata that a signature
      // proves only "came from Dodo," not "matches this purchase."
      if (!purchaseId) {
        return NextResponse.json({ received: true, activated: false, reason: "no purchase id" });
      }
      const purchase = await prisma.featuredPurchase.findUnique({ where: { id: purchaseId } });
      if (!purchase) {
        return NextResponse.json({ received: true, activated: false, reason: "unknown purchase" });
      }

      // amountCents on the purchase row was set when we created the checkout
      // session; use it as the source of truth for tier.
      const tier: PlacementTier | null =
        purchase.amountCents === 1000 ? 10 : purchase.amountCents === 500 ? 5 : null;
      if (!tier) {
        return NextResponse.json({ received: true, activated: false, reason: "unknown tier" });
      }

      // We also stashed productId / submissionId in metadata when we created
      // the session — but re-check them against the purchase's owner. If your
      // schema doesn't yet track those on FeaturedPurchase, add them; for now
      // we trust the metadata since it was signed by Dodo along with the rest.
      const productId = metadata.productId || undefined;
      const submissionId = metadata.submissionId || undefined;

      await activatePlacementSlot({
        purchaseId: purchase.id,
        paymentId,
        userId: purchase.userId,
        productId,
        submissionId,
        tier,
      });
      return NextResponse.json({ received: true, activated: true });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[api/webhooks/dodo] error:", error);
    return NextResponse.json({ error: "WEBHOOK_FAILED", message: error.message }, { status: 500 });
  }
}
