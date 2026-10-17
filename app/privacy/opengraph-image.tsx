import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "The Launch Feed privacy policy";

export default staticOgImage({
  eyebrow: "Legal",
  title: "Privacy Policy",
  subtitle: "How The Launch Feed collects, uses and protects your data.",
});
