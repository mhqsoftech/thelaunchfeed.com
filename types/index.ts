export type LeaderboardPeriod = "daily" | "weekly" | "monthly";

export interface ProductWithRank {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  websiteUrl: string;
  voteCount: number;
  commentCount: number;
  launchedAt: Date;
  rank: number;
  score: number;
  owner: {
    username: string;
    name: string | null;
    image: string | null;
  };
  tags: string[];
  hasVoted?: boolean;
}

export interface LeaderboardData {
  period: LeaderboardPeriod;
  periodKey: string;
  products: ProductWithRank[];
}
