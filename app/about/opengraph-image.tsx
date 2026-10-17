import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "About The Launch Feed";

export default staticOgImage({
  eyebrow: "About",
  title: "Ship. Vote. Rise.",
  subtitle: "A daily launchpad where indie makers launch software and the community ranks it.",
});
