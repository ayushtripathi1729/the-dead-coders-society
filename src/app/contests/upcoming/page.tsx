import { ContestStatusPage } from "@/components/contest-status-page";
import { listContests } from "@/lib/leaderboards";

export const dynamic = "force-dynamic";

export default async function UpcomingContestsPage() {
  const contests = (await listContests())
    .filter((contest) => contest.status === "UPCOMING")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return <ContestStatusPage eyebrow="Schedule" title="Upcoming Contests" description="Scheduled contests that have not started yet." contests={contests} />;
}
