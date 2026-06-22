import { ContestStatusPage } from "@/components/contest-status-page";
import { listContests } from "@/lib/leaderboards";

export const revalidate = 120;

export default async function CompletedContestsPage() {
  const contests = (await listContests()).filter((contest) => contest.status === "COMPLETED");
  return <ContestStatusPage eyebrow="Archive" title="Past Contests" description="Completed contests whose scheduled duration has elapsed." contests={contests} />;
}
