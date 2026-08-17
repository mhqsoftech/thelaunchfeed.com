export type ProductAward =
  | "launch"
  | "pod"
  | "daily_1"
  | "daily_2"
  | "daily_3"
  | "weekly_1"
  | "weekly_2"
  | "weekly_3"
  | "monthly_1"
  | "monthly_2"
  | "monthly_3"
  | "champion"
  | "yearly_1"
  | "yearly_2"
  | "yearly_3"
  | "alltime_1"
  | "alltime_2"
  | "alltime_3"
  | "revenue"
  | "upvote";

export interface AccoladeItem {
  id: ProductAward;
  title: string;
  shortTag: string;
  badgeLabel: string;
  description: string;
  periodType: "daily" | "weekly" | "monthly" | "yearly" | "alltime" | "telemetry" | "launch";
  rank?: number;
  rankBadge?: string;
  badgeAwardParam: string;
  // Tone styling for UI ribbons and badges (crisp, minimal, flat)
  tone: {
    border: string;
    text: string;
    bg: string;
  };
  downloadUrl: string;
}

/**
 * Maps raw award keys to fully styled Accolade display items for UI rendering
 * and direct badge asset downloads. Client-safe (zero DB dependencies).
 */
export function getAccoladeDetails(
  awards: ProductAward[],
  slug: string,
  extra?: { revenueFormatted?: string }
): AccoladeItem[] {
  const normalized = Array.from(new Set(awards));
  const accolades: AccoladeItem[] = [];

  const addAccolade = (item: Omit<AccoladeItem, "downloadUrl">) => {
    accolades.push({
      ...item,
      downloadUrl: `/api/badge/${encodeURIComponent(slug)}?award=${encodeURIComponent(
        item.badgeAwardParam
      )}&download=true`,
    });
  };

  // 1. Daily Awards
  if (normalized.includes("daily_1") || normalized.includes("pod")) {
    addAccolade({
      id: "daily_1",
      title: "#1 Product of the Day",
      shortTag: "#1 Daily",
      badgeLabel: "#1 PRODUCT OF THE DAY",
      description: "Apex 1st place daily leaderboard finisher",
      periodType: "daily",
      rank: 1,
      rankBadge: "#1",
      badgeAwardParam: "daily_1",
      tone: {
        border: "border-signal",
        text: "text-signal",
        bg: "bg-signal/10",
      },
    });
  }
  if (normalized.includes("daily_2")) {
    addAccolade({
      id: "daily_2",
      title: "#2 Product of the Day",
      shortTag: "#2 Daily",
      badgeLabel: "#2 PRODUCT OF THE DAY",
      description: "2nd place daily leaderboard finalist",
      periodType: "daily",
      rank: 2,
      rankBadge: "#2",
      badgeAwardParam: "daily_2",
      tone: {
        border: "border-hairline",
        text: "text-ink",
        bg: "bg-surface/60",
      },
    });
  }
  if (normalized.includes("daily_3")) {
    addAccolade({
      id: "daily_3",
      title: "#3 Product of the Day",
      shortTag: "#3 Daily",
      badgeLabel: "#3 PRODUCT OF THE DAY",
      description: "3rd place daily leaderboard finalist",
      periodType: "daily",
      rank: 3,
      rankBadge: "#3",
      badgeAwardParam: "daily_3",
      tone: {
        border: "border-amber-600/60 dark:border-amber-500/60",
        text: "text-amber-700 dark:text-amber-400",
        bg: "bg-amber-500/10",
      },
    });
  }

  // 2. Weekly Awards
  if (normalized.includes("weekly_1")) {
    addAccolade({
      id: "weekly_1",
      title: "#1 Product of the Week",
      shortTag: "#1 Weekly",
      badgeLabel: "#1 PRODUCT OF THE WEEK",
      description: "Top software product on the weekly leaderboard",
      periodType: "weekly",
      rank: 1,
      rankBadge: "#1",
      badgeAwardParam: "weekly_1",
      tone: {
        border: "border-emerald-500/80 dark:border-emerald-400/80",
        text: "text-emerald-700 dark:text-emerald-400",
        bg: "bg-emerald-500/10",
      },
    });
  }
  if (normalized.includes("weekly_2")) {
    addAccolade({
      id: "weekly_2",
      title: "#2 Product of the Week",
      shortTag: "#2 Weekly",
      badgeLabel: "#2 PRODUCT OF THE WEEK",
      description: "2nd place weekly leaderboard finalist",
      periodType: "weekly",
      rank: 2,
      rankBadge: "#2",
      badgeAwardParam: "weekly_2",
      tone: {
        border: "border-hairline hover:border-ink",
        text: "text-ink",
        bg: "bg-surface",
      },
    });
  }
  if (normalized.includes("weekly_3")) {
    addAccolade({
      id: "weekly_3",
      title: "#3 Product of the Week",
      shortTag: "#3 Weekly",
      badgeLabel: "#3 PRODUCT OF THE WEEK",
      description: "3rd place weekly leaderboard finalist",
      periodType: "weekly",
      rank: 3,
      rankBadge: "#3",
      badgeAwardParam: "weekly_3",
      tone: {
        border: "border-hairline",
        text: "text-ink-dim",
        bg: "bg-surface/50",
      },
    });
  }

  // 3. Monthly Awards
  if (normalized.includes("monthly_1")) {
    addAccolade({
      id: "monthly_1",
      title: "#1 Product of the Month",
      shortTag: "#1 Monthly",
      badgeLabel: "#1 PRODUCT OF THE MONTH",
      description: "1st place monthly leaderboard champion",
      periodType: "monthly",
      rank: 1,
      rankBadge: "#1",
      badgeAwardParam: "monthly_1",
      tone: {
        border: "border-signal",
        text: "text-signal",
        bg: "bg-signal/10",
      },
    });
  }
  if (normalized.includes("monthly_2")) {
    addAccolade({
      id: "monthly_2",
      title: "#2 Product of the Month",
      shortTag: "#2 Monthly",
      badgeLabel: "#2 PRODUCT OF THE MONTH",
      description: "2nd place monthly leaderboard finalist",
      periodType: "monthly",
      rank: 2,
      rankBadge: "#2",
      badgeAwardParam: "monthly_2",
      tone: {
        border: "border-hairline hover:border-ink",
        text: "text-ink",
        bg: "bg-surface",
      },
    });
  }
  if (normalized.includes("monthly_3")) {
    addAccolade({
      id: "monthly_3",
      title: "#3 Product of the Month",
      shortTag: "#3 Monthly",
      badgeLabel: "#3 PRODUCT OF THE MONTH",
      description: "3rd place monthly leaderboard finalist",
      periodType: "monthly",
      rank: 3,
      rankBadge: "#3",
      badgeAwardParam: "monthly_3",
      tone: {
        border: "border-hairline",
        text: "text-ink-dim",
        bg: "bg-surface/50",
      },
    });
  }

  // 4. Yearly Awards
  if (normalized.includes("yearly_1") || normalized.includes("champion")) {
    addAccolade({
      id: "yearly_1",
      title: "2026 Yearly Champion",
      shortTag: "2026 Champion",
      badgeLabel: "2026 YEARLY CHAMPION",
      description: "Top ranked software product of the entire year",
      periodType: "yearly",
      rank: 1,
      rankBadge: "#1",
      badgeAwardParam: "yearly_1",
      tone: {
        border: "border-yellow-500 dark:border-yellow-400",
        text: "text-yellow-700 dark:text-yellow-300",
        bg: "bg-yellow-50 dark:bg-yellow-950/40",
      },
    });
  }
  if (normalized.includes("yearly_2")) {
    addAccolade({
      id: "yearly_2",
      title: "2026 Yearly Finalist #2",
      shortTag: "2026 #2",
      badgeLabel: "2026 YEARLY FINALIST #2",
      description: "2nd place annual leaderboard finalist",
      periodType: "yearly",
      rank: 2,
      rankBadge: "#2",
      badgeAwardParam: "yearly_2",
      tone: {
        border: "border-hairline",
        text: "text-ink",
        bg: "bg-surface",
      },
    });
  }
  if (normalized.includes("yearly_3")) {
    addAccolade({
      id: "yearly_3",
      title: "2026 Yearly Finalist #3",
      shortTag: "2026 #3",
      badgeLabel: "2026 YEARLY FINALIST #3",
      description: "3rd place annual leaderboard finalist",
      periodType: "yearly",
      rank: 3,
      rankBadge: "#3",
      badgeAwardParam: "yearly_3",
      tone: {
        border: "border-hairline",
        text: "text-ink-dim",
        bg: "bg-surface/50",
      },
    });
  }

  // 5. All-Time Awards
  if (normalized.includes("alltime_1")) {
    addAccolade({
      id: "alltime_1",
      title: "All-Time #1 GOAT",
      shortTag: "All-Time #1",
      badgeLabel: "ALL-TIME #1 GOAT",
      description: "Hall of Fame top voted software of all time",
      periodType: "alltime",
      rank: 1,
      rankBadge: "#1",
      badgeAwardParam: "alltime_1",
      tone: {
        border: "border-signal",
        text: "text-signal",
        bg: "bg-signal/10",
      },
    });
  }
  if (normalized.includes("alltime_2")) {
    addAccolade({
      id: "alltime_2",
      title: "All-Time #2 Aegis",
      shortTag: "All-Time #2",
      badgeLabel: "ALL-TIME #2",
      description: "Hall of Fame 2nd place of all time",
      periodType: "alltime",
      rank: 2,
      rankBadge: "#2",
      badgeAwardParam: "alltime_2",
      tone: {
        border: "border-hairline",
        text: "text-ink",
        bg: "bg-surface",
      },
    });
  }
  if (normalized.includes("alltime_3")) {
    addAccolade({
      id: "alltime_3",
      title: "All-Time #3 Laurel",
      shortTag: "All-Time #3",
      badgeLabel: "ALL-TIME #3",
      description: "Hall of Fame 3rd place of all time",
      periodType: "alltime",
      rank: 3,
      rankBadge: "#3",
      badgeAwardParam: "alltime_3",
      tone: {
        border: "border-hairline",
        text: "text-ink-dim",
        bg: "bg-surface/50",
      },
    });
  }

  // 6. Revenue & Telemetry
  if (normalized.includes("revenue")) {
    addAccolade({
      id: "revenue",
      title: "Verified Revenue Telemetry",
      shortTag: `Verified MRR ${extra?.revenueFormatted || ""}`.trim(),
      badgeLabel: "VERIFIED MRR TELEMETRY",
      description: "Cryptographically authenticated live revenue proof",
      periodType: "telemetry",
      rankBadge: "MRR",
      badgeAwardParam: "revenue",
      tone: {
        border: "border-emerald-500/60 dark:border-emerald-400/60",
        text: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10",
      },
    });
  }

  // 7. Community Upvotes
  if (normalized.includes("upvote")) {
    addAccolade({
      id: "upvote",
      title: "Community Top Voted",
      shortTag: "Top Voted",
      badgeLabel: "COMMUNITY TOP VOTED",
      description: "Passed significant community upvote threshold",
      periodType: "telemetry",
      rankBadge: "VOTED",
      badgeAwardParam: "upvote",
      tone: {
        border: "border-signal/40",
        text: "text-signal",
        bg: "bg-signal/5",
      },
    });
  }

  return accolades;
}
