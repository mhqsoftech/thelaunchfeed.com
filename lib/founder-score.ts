export type FounderLevelBase = {
  level: number;
  title: string;
  shortCode: string;
  badgeLabel: string;
  tagline: string;
  perk: string;
  color: string;
  bgStyle: string;
  borderStyle: string;
  textStyle: string;
  minPoints: number;
  nextLevelPoints: number | null;
};

export const FOUNDER_LEVELS_BASE: FounderLevelBase[] = [
  {
    level: 1,
    title: "Genesis Founder",
    shortCode: "GENESIS",
    badgeLabel: "LEVEL 01 · GENESIS",
    tagline: "Initiating software launch sequence into the ecosystem",
    perk: "Live profile telemetry & basic community recognition",
    color: "var(--ink-dim)",
    bgStyle: "bg-surface/50",
    borderStyle: "border-hairline",
    textStyle: "text-ink-dim",
    minPoints: 0,
    nextLevelPoints: 25,
  },
  {
    level: 2,
    title: "Velocity Builder",
    shortCode: "VELOCITY",
    badgeLabel: "LEVEL 02 · VELOCITY",
    tagline: "Building momentum with rapid shipping speed & execution",
    perk: "Verified Builder badge & Priority directory indexing",
    color: "var(--ink)",
    bgStyle: "bg-surface/80",
    borderStyle: "border-ink/20",
    textStyle: "text-ink",
    minPoints: 25,
    nextLevelPoints: 75,
  },
  {
    level: 3,
    title: "Apex Innovator",
    shortCode: "APEX",
    badgeLabel: "LEVEL 03 · APEX",
    tagline: "Demonstrating high craft & strong community product traction",
    perk: "Apex badge glow & Featured launch discovery eligibility",
    color: "var(--signal)",
    bgStyle: "bg-signal/5",
    borderStyle: "border-signal/40",
    textStyle: "text-signal",
    minPoints: 75,
    nextLevelPoints: 200,
  },
  {
    level: 4,
    title: "Titan Architect",
    shortCode: "TITAN",
    badgeLabel: "LEVEL 04 · TITAN",
    tagline: "Mastering scalable engineering & deep developer trust",
    perk: "Titan Architect flair & Dedicated founder showcase slots",
    color: "var(--signal)",
    bgStyle: "bg-signal/10",
    borderStyle: "border-signal/60",
    textStyle: "text-signal",
    minPoints: 200,
    nextLevelPoints: 500,
  },
  {
    level: 5,
    title: "Luminary Syndicate",
    shortCode: "LUMINARY",
    badgeLabel: "LEVEL 05 · LUMINARY",
    tagline: "Ecosystem legend & visionary software craftsman",
    perk: "Ecosystem Luminary Hall-of-Fame & VIP launch broadcast rights",
    color: "var(--signal)",
    bgStyle: "bg-signal/15",
    borderStyle: "border-signal",
    textStyle: "text-signal",
    minPoints: 500,
    nextLevelPoints: null,
  },
];

export function getFounderScore(
  productsCount: number,
  totalVotes: number,
  joinedAtStr?: string,
  votesGiven: number = 0
): {
  points: number;
  currentLevel: FounderLevelBase;
  nextLevel: FounderLevelBase | null;
  progressPercent: number;
  ageDays: number;
} {
  let ageDays = 15;
  if (joinedAtStr) {
    const joinedTime = new Date(joinedAtStr).getTime();
    if (!isNaN(joinedTime)) {
      ageDays = Math.max(1, Math.floor((Date.now() - joinedTime) / (1000 * 60 * 60 * 24)));
    }
  }

  // Scoring matrix:
  //   20 pts per product launched
  //   2  pts per upvote RECEIVED on the founder's own products
  //   1  pt  per upvote GIVEN to other products (community participation)
  //   up to 90 age-bonus points
  const points =
    (productsCount * 20) +
    (totalVotes * 2) +
    (votesGiven * 1) +
    Math.min(ageDays, 90);

  let currentLevel = FOUNDER_LEVELS_BASE[0];
  let nextLevel: FounderLevelBase | null = FOUNDER_LEVELS_BASE[1];

  for (let i = FOUNDER_LEVELS_BASE.length - 1; i >= 0; i--) {
    if (points >= FOUNDER_LEVELS_BASE[i].minPoints) {
      currentLevel = FOUNDER_LEVELS_BASE[i];
      nextLevel = FOUNDER_LEVELS_BASE[i + 1] || null;
      break;
    }
  }

  let progressPercent = 100;
  if (nextLevel) {
    const range = nextLevel.minPoints - currentLevel.minPoints;
    const gained = points - currentLevel.minPoints;
    progressPercent = Math.min(100, Math.max(0, Math.round((gained / range) * 100)));
  }

  return { points, currentLevel, nextLevel, progressPercent, ageDays };
}
