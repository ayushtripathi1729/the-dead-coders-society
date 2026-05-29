import type { ContestEntry } from "@/lib/types";

export const placementBonus: Record<number, number> = {
  1: 500,
  2: 250,
  3: 125,
  4: 50,
  5: 25,
};

export function bonusForRank(rank: number) {
  return placementBonus[rank] ?? 0;
}

export function rawScoreForSolved(solved: number) {
  return solved * 100;
}

export function finalContestScore(totalPoints: number, penalty: number, prizePoints = 0) {
  return totalPoints - penalty + prizePoints;
}

export function scoreEntry(entry: Omit<ContestEntry, "bonusPoints" | "finalScore">): ContestEntry {
  const bonusPoints = bonusForRank(entry.rank);
  return {
    ...entry,
    bonusPoints,
    finalScore: finalContestScore(entry.rawScore + entry.penalty, entry.penalty, bonusPoints),
  };
}

export function societyRatingDelta(input: {
  rank: number;
  solved: number;
  participantCount: number;
  finalScore: number;
  firstSolves: number;
}) {
  const field = Math.max(input.participantCount, 1);
  const placement = ((field - input.rank + 1) / field) * 80 - 28;
  const solvePressure = input.solved * 7;
  const scoreSignal = Math.min(45, input.finalScore / 45);
  const firstSolveSignal = input.firstSolves * 9;
  const podiumStability = input.rank <= 3 ? 22 - input.rank * 4 : 0;

  return Math.round(placement + solvePressure + scoreSignal + firstSolveSignal + podiumStability);
}
