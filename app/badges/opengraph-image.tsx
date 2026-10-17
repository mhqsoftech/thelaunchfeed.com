import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "The Launch Feed badges and trophies";

export default staticOgImage({
  eyebrow: "Badges",
  title: "Launch badges & trophies",
  subtitle: "Embeddable badges for launches, daily, weekly and monthly winners.",
});
