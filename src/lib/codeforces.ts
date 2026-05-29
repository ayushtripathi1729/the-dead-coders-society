import "server-only";

import type { EntryInput } from "@/lib/admin-actions";

export function extractCodeforcesContestId(url: string) {
  const match = url.match(/codeforces\.com\/(?:contest|gym)\/(\d+)\/standings/i);
  return match?.[1] ?? null;
}

type CodeforcesStanding = {
  party: { members?: { handle: string }[]; participantType?: string };
  rank: number;
  points: number;
  penalty: number;
  problemResults?: { points: number; bestSubmissionTimeSeconds?: number }[];
};

export async function fetchCodeforcesStandings(url: string): Promise<EntryInput[]> {
  const contestId = extractCodeforcesContestId(url);
  if (!contestId) {
    throw new Error("Paste a valid Codeforces /contest/{id}/standings URL.");
  }

  const response = await fetch(
    `https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=500&showUnofficial=true`,
    { next: { revalidate: 60 } },
  );
  const payload = await response.json();
  if (payload.status !== "OK") {
    throw new Error(payload.comment ?? "Codeforces API did not return standings.");
  }

  return payload.result.rows.map((row: CodeforcesStanding) => {
    const username = row.party.members?.map((member) => member.handle).join("+") || "unknown";
    const solved = row.problemResults?.filter((problem) => problem.points > 0).length ?? 0;
    return {
      username,
      fullName: username,
      solved,
      penalty: row.penalty,
    };
  });
}
