import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Product categories on The Launch Feed";

export default staticOgImage({
  eyebrow: "Categories",
  title: "Browse software & AI by category",
  subtitle: "AI tools, developer tools, SaaS, design and more, ranked by the community.",
});
