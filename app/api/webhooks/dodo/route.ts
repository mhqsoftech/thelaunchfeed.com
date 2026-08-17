import { NextResponse } from "next/server";
import { activatePlacementSlot, PlacementTier } from "@/lib/dodopayments";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const eventType = payload.type || payload.event_type || payload.event;
    const data = payload.data || payload;

    // Handle payment or checkout success events
    if (
      eventType === "payment.succeeded" ||
      eventType === "checkout.session.completed" ||
      eventType === "payment_intent.succeeded" ||
      data.status === "succeeded"
    ) {
      const metadata = data.metadata || {};
      const purchaseId = metadata.purchaseId || data.purchase_id;
      const productId = metadata.productId || data.product_id;
      const userId = metadata.userId || data.user_id || "webhook_user";
      const tier = (Number(metadata.tier) || (data.total_amount === 1000 ? 10 : 5)) as PlacementTier;
      const paymentId = data.payment_id || data.id || `dodo_wh_${Date.now()}`;

      if (productId && (tier === 5 || tier === 10)) {
        await activatePlacementSlot({
          purchaseId,
          paymentId,
          userId,
          productId,
          tier,
        });
        return NextResponse.json({ received: true, activated: true });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[api/webhooks/dodo] error:", error);
    return NextResponse.json({ error: "WEBHOOK_FAILED", message: error.message }, { status: 500 });
  }
}
