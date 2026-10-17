import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Product leaderboard on The Launch Feed";

const TITLES: Record<string, [string, string]> = {
  weekly: ["This week", "Best new software & AI products this week"],
  monthly: ["This month", "Best new products this month"],
  yearly: ["This year", "Best software & AI products of the year"],
  "all-time": ["Hall of Fame", "All-time top products"],
};

export default async function LeaderboardOgImage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  const [eyebrow, title] = TITLES[period] || ["Leaderboard", "Top launches on The Launch Feed"];
  return ogCard({
    eyebrow,
    title,
    subtitle: "Ranked by community upvotes. Updated in real time.",
    image: "/logo.png",
  });
}
