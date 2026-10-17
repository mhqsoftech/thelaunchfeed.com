import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Top founders on The Launch Feed";

export default staticOgImage({
  eyebrow: "Founders",
  title: "Top founders building in public",
  subtitle: "Indie makers ranked by their launches and community upvotes.",
});
