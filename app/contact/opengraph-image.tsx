import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Contact The Launch Feed";

export default staticOgImage({
  eyebrow: "Contact",
  title: "Talk to The Launch Feed team",
  subtitle: "Launch questions, sponsorships, partnerships and support.",
});
