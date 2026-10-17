import { staticOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "The Launch Feed — the daily software and AI product leaderboard";

export default staticOgImage({
  eyebrow: "Daily launches",
  title: "The daily leaderboard for new software & AI",
  subtitle: "Discover new products every day, vote for the best, and launch your own.",
});
