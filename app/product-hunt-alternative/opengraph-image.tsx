import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A free Product Hunt alternative for daily launches";

export default staticOgImage({
  eyebrow: "Product Hunt alternative",
  title: "A free Product Hunt alternative for daily launches",
  subtitle: "Launch at 6:00 AM IST, get upvotes, win badges and keep a permanent product page.",
});
