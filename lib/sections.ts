export const ALL_SECTIONS = [
  { id: "daily", name: "Daily Leaderboard Feed", desc: "Top launches of today & 24h drop queue on the home board." },
  { id: "weekly", name: "Weekly Leaderboard", desc: "Top ranked products of the current week." },
  { id: "monthly", name: "Monthly Leaderboard", desc: "Top software tools and highest upvoted products of the month." },
  { id: "yearly", name: "Yearly Leaderboard", desc: "Hall of fame rankings and yearly award winners." },
  { id: "alltime", name: "All-Time Hall of Fame", desc: "Cumulative all-time software rankings." },
  { id: "categories", name: "Category Pages", desc: "Taxonomy directory listings at /category/[slug]." },
  { id: "featured", name: "Featured & Rotating Slots", desc: "Header marquee banners and search spotlight slots." },
] as const;

export type SectionId = (typeof ALL_SECTIONS)[number]["id"];
