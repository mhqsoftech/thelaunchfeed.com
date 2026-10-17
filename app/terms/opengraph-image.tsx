import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "The Launch Feed terms of service";

export default staticOgImage({
  eyebrow: "Legal",
  title: "Terms of Service",
  subtitle: "The rules for launching, voting and listing on The Launch Feed.",
});
