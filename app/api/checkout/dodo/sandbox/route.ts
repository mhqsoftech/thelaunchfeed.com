import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PlacementTier, PLACEMENT_TIERS } from "@/lib/dodopayments";

// Every interpolation into the HTML template below runs through this — a
// product name containing `</div><script>…</script>` would otherwise execute
// on thelaunchfeed.com origin for any visitor loaded with that productId in
// the URL.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const purchaseId = searchParams.get("purchaseId");
  const productId = searchParams.get("productId");
  const submissionId = searchParams.get("submissionId");
  const tierNum = Number(searchParams.get("tier")) as PlacementTier;
  const returnTo = searchParams.get("returnTo") || (submissionId ? "submit" : "profile");

  if (!purchaseId || (!productId && !submissionId) || (tierNum !== 5 && tierNum !== 10)) {
    return new Response("Invalid checkout parameters", { status: 400 });
  }

  const purchase = await prisma.featuredPurchase.findUnique({
    where: { id: purchaseId },
    include: { user: true },
  });

  if (!purchase) {
    return new Response("Purchase session not found", { status: 404 });
  }

  let displayName = "Product Launch";
  if (submissionId) {
    const sub = await prisma.submission.findUnique({ where: { id: submissionId }, select: { name: true } });
    if (sub?.name) displayName = sub.name;
  } else if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    if (product?.name) displayName = product.name;
  }

  const tierConfig = PLACEMENT_TIERS[tierNum];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dodo Payments - Complete Launch Placement</title>
  <style>
    :root {
      --bg: #090A0C;
      --card: #111318;
      --border: #22262E;
      --text: #F3F4F6;
      --muted: #9CA3AF;
      --signal: #00D97E;
      --accent: #38BDF8;
    }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "JetBrains Mono", monospace;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
      box-sizing: border-box;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      max-width: 460px;
      width: 100%;
      padding: 2rem;
      box-sizing: border-box;
      border-radius: 4px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 800;
      font-size: 0.9rem;
      letter-spacing: 0.05em;
    }
    .badge {
      font-size: 0.65rem;
      text-transform: uppercase;
      padding: 0.2rem 0.5rem;
      border: 1px solid var(--signal);
      color: var(--signal);
      font-weight: bold;
      background: rgba(0,217,126,0.1);
    }
    .product-box {
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border);
      padding: 1rem;
      margin-bottom: 1.5rem;
    }
    .product-name {
      font-size: 1.1rem;
      font-weight: bold;
      margin-bottom: 0.25rem;
    }
    .product-tag {
      font-size: 0.8rem;
      color: var(--muted);
    }
    .price-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 1.25rem 0;
      padding: 0.75rem 0;
      border-top: 1px dashed var(--border);
      border-bottom: 1px dashed var(--border);
      font-size: 0.95rem;
    }
    .total-price {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--signal);
    }
    .btn {
      display: block;
      width: 100%;
      padding: 0.85rem;
      background: var(--signal);
      color: #000;
      font-weight: 800;
      font-size: 0.9rem;
      text-align: center;
      border: none;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: opacity 0.2s;
      margin-top: 1.5rem;
      text-decoration: none;
      box-sizing: border-box;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .secure-note {
      text-align: center;
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">
        <span>🦤 DODO PAYMENTS</span>
      </div>
      <span class="badge">Checkout</span>
    </div>

    <div class="product-box">
      <div class="product-name">${escapeHtml(displayName)}</div>
      <div class="product-tag">${escapeHtml(tierConfig.headline)} · 30 Days Duration</div>
    </div>

    <div style="font-size: 0.82rem; color: var(--muted); line-height: 1.5;">
      ✓ Placement: <strong>${escapeHtml(tierConfig.name)}</strong><br>
      ✓ Duration: <strong>30 Continuous Days Active</strong><br>
      ✓ Activated seamlessly when product goes live on The Launch Feed
    </div>

    <div class="price-row">
      <span>Total Amount</span>
      <span class="total-price">${escapeHtml(tierConfig.priceFormatted)} USD</span>
    </div>

    <form method="POST" action="/api/checkout/dodo/verify">
      <input type="hidden" name="purchaseId" value="${escapeHtml(purchase.id)}" />
      <input type="hidden" name="productId" value="${escapeHtml(productId || "")}" />
      <input type="hidden" name="submissionId" value="${escapeHtml(submissionId || "")}" />
      <input type="hidden" name="tier" value="${tierNum}" />
      <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
      <input type="hidden" name="paymentId" value="dodo_pay_${Date.now()}" />
      <button type="submit" class="btn">
        Pay ${escapeHtml(tierConfig.priceFormatted)} via Dodo Payments →
      </button>
    </form>

    <div class="secure-note">
      🔒 256-bit Encrypted Dodo Payments Checkout
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
