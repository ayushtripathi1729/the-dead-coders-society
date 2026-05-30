import { ContestStatusPage } from "@/components/contest-status-page";
import { listContests } from "@/lib/leaderboards";

export const dynamic = "force-dynamic";

export default async function LiveContestsPage() {
  const contests = (await listContests()).filter((contest) => contest.status === "LIVE");
  return <ContestStatusPage eyebrow="Now Running" title="Live Contests" description="Contests currently inside their scheduled duration window." contests={contests} />;
}
