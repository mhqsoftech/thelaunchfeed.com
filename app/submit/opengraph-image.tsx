import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Submit a product to The Launch Feed";

export default staticOgImage({
  eyebrow: "Launch",
  title: "Launch your product on The Launch Feed",
  subtitle: "Free daily launches with a dofollow backlink, or a paid spotlight for 30 days.",
});
