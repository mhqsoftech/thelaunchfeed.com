const GRAVITY = 1.6;
const OFFSET_HOURS = 2;

export function dailyScore(
  voteWeightSum: number,
  launchedAt: Date,
  now = new Date()
) {
  const ageHours = (now.getTime() - launchedAt.getTime()) / 3_600_000;
  return voteWeightSum / Math.pow(ageHours + OFFSET_HOURS, GRAVITY);
}

export function weeklyScore(
  votes: Array<{ isFlagged: boolean; weight: number }>
) {
  return votes
    .filter((v) => !v.isFlagged)
    .reduce((sum, v) => sum + v.weight, 0);
}

export function monthlyScore(p: {
  votes: number;
  comments: number;
  uniqueVoters: number;
}) {
  return p.votes * 1.0 + p.comments * 2.5 + p.uniqueVoters * 0.5;
}
