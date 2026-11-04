import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Where to launch your product: a free launch plan";

export default staticOgImage({
  eyebrow: "Launch guide",
  title: "Where to launch your product",
  subtitle: "Launch boards, founder communities and directories, plus a two-week plan.",
});
