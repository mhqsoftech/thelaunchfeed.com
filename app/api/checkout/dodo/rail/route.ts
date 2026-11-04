import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createRailCheckout,
  parseCustomProduct,
  storeCustomIcon,
  RAIL_MAX_BLOCKS,
  RAIL_MAX_ITEMS,
  type RailItem,
} from "@/lib/rail-spotlight";
import { assertSafeUrl } from "@/lib/ssrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BodyItem = { productId?: string; submissionId?: string; custom?: unknown };

/**
 * POST /api/checkout/dodo/rail
 * Body: { blocks, items: [{ productId } | { submissionId } | { custom: { url, name, tagline, logoUrl } }] }
 * Starts a checkout for the sidebar Spotlight: $1 per product per 3-day
 * block. Listed products and launches must belong to the signed-in user; a
 * custom product is any site the buyer describes.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHENTICATED", message: "Please sign in to reserve a slot" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as BodyItem & { blocks?: number; items?: BodyItem[] };
    const blocks = Number(body.blocks);
    if (!Number.isInteger(blocks) || blocks < 1 || blocks > RAIL_MAX_BLOCKS) {
      return NextResponse.json(
        { error: "INVALID_DURATION", message: `Choose between 1 and ${RAIL_MAX_BLOCKS} blocks of 3 days` },
        { status: 400 }
      );
    }

    // Older clients sent a single product at the top level.
    const requested: BodyItem[] = Array.isArray(body.items) ? body.items : [body];
    if (requested.length === 0) {
      return NextResponse.json({ error: "NO_PRODUCTS", message: "Choose at least one product" }, { status: 400 });
    }
    if (requested.length > RAIL_MAX_ITEMS) {
      return NextResponse.json(
        { error: "TOO_MANY", message: `One booking can sponsor up to ${RAIL_MAX_ITEMS} products` },
        { status: 400 }
      );
    }

    const items: RailItem[] = [];
    const names: string[] = [];
    const seen = new Set<string>();
    const stamp = Date.now().toString(36);

    for (const [i, it] of requested.entries()) {
      if (it.custom) {
        // A product that isn't listed here: the buyer's URL, name, tagline, icon.
        const custom = parseCustomProduct(it.custom);
        if (!custom) {
          return NextResponse.json({ error: "INVALID_PRODUCT", message: "Every product needs a URL and a name" }, { status: 400 });
        }
        if (!(await assertSafeUrl(custom.url)).ok) {
          return NextResponse.json({ error: "INVALID_URL", message: `${custom.url} can't be used` }, { status: 400 });
        }
        if (seen.has(`url:${custom.url}`)) continue;
        seen.add(`url:${custom.url}`);
        const logoUrl = await storeCustomIcon(custom.logoUrl, `${user.id}-${stamp}-${i}`);
        items.push({ type: "custom", ...custom, logoUrl });
        names.push(custom.name);
      } else if (it.productId) {
        if (seen.has(`p:${it.productId}`)) continue;
        const product = await prisma.product.findFirst({
          where: { id: it.productId, status: "LIVE", OR: [{ ownerId: user.id }, { makers: { some: { userId: user.id } } }] },
          select: { id: true, name: true },
        });
        if (!product) return NextResponse.json({ error: "NOT_FOUND", message: "That product isn't yours" }, { status: 404 });
        seen.add(`p:${product.id}`);
        items.push({ type: "product", productId: product.id });
        names.push(product.name);
      } else if (it.submissionId) {
        if (seen.has(`s:${it.submissionId}`)) continue;
        const sub = await prisma.submission.findFirst({
          where: { id: it.submissionId, ownerId: user.id, status: { in: ["SCHEDULED", "PUBLISHED"] } },
          select: { id: true, name: true },
        });
        if (!sub) return NextResponse.json({ error: "NOT_FOUND", message: "That launch isn't yours" }, { status: 404 });
        seen.add(`s:${sub.id}`);
        items.push({ type: "submission", submissionId: sub.id });
        names.push(sub.name);
      }
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "NO_PRODUCTS", message: "Choose at least one product" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const result = await createRailCheckout({
      user: { id: user.id, email: user.email, name: user.name || user.username },
      items,
      label: names.join(", "),
      blocks,
      appUrl,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[api/checkout/dodo/rail] error:", error);
    // Our own errors are written for people; anything else (database, SDK)
    // stays in the server log.
    const known = typeof error?.message === "string" && error.message.startsWith("Checkout is unavailable");
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: known ? error.message : "Checkout could not start. Please try again in a moment." },
      { status: 500 }
    );
  }
}
