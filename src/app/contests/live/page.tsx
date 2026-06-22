import { ContestStatusPage } from "@/components/contest-status-page";
import { listContests } from "@/lib/leaderboards";

export const revalidate = 30;

export default async function LiveContestsPage() {
  const contests = (await listContests()).filter((contest) => contest.status === "LIVE");
  return <ContestStatusPage eyebrow="Now Running" title="Live Contests" description="Contests currently inside their scheduled duration window." contests={contests} />;
}
