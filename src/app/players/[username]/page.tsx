import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BadgeCheck, BarChart3, Crown, Flame, Gauge, Trophy, Zap } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { Nav } from "@/components/nav";
import { PlayerChart } from "@/components/player-chart";
import { yearLabel } from "@/lib/labels";
import { getPlayer, type PlayerProfile } from "@/lib/leaderboards";
import { formatDateUTC } from "@/lib/utils";

export const revalidate = 60;

type ChartPoint = { contest: string; score: number };
type PlayerHistoryItem = PlayerProfile["history"][number];
type PlayerRating = PlayerProfile["ratings"][number];

export default async function PlayerPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const player = await getPlayer(decodeURIComponent(username));
  if (!player) notFound();

  const scoreChart = player.history
    .slice()
    .reverse()
    .reduce((chart: ChartPoint[], { contest, entry }: PlayerHistoryItem): ChartPoint[] => [
      ...chart,
      { contest: contest.title.slice(0, 14), score: (chart.at(-1)?.score ?? 0) + entry.finalScore },
    ], []);
  const ratingChart = player.ratings.length
    ? player.ratings.map((rating: PlayerRating, index: number): ChartPoint => ({ contest: `R${index + 1}`, score: rating.rating }))
    : [{ contest: "Base", score: player.rating }];
  const placementChart = player.history.slice().reverse().map(({ contest, entry }: PlayerHistoryItem): ChartPoint => ({ contest: contest.title.slice(0, 14), score: entry.rank }));

  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6">
        <section className="section-band p-6 md:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="engraved text-xs">Official Player Record</p>
              <h1 data-text={player.fullName} className="glitch certificate-title mt-3 text-5xl text-white sm:text-7xl">{player.fullName}</h1>
              <p className="mt-3 font-[family-name:var(--font-display)] text-xl uppercase text-[#9AFF00]">@{player.username}</p>
              <p className="font-[family-name:var(--font-mono)] text-zinc-400">{yearLabel(player.year)} / {player.ratingTitle}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(player.achievements.length ? player.achievements : [{ title: "Registered Contender", description: "Official TDS profile." }]).slice(0, 5).map((badge) => (
                  <span key={badge.title} className="clip-arena inline-flex items-center gap-2 border border-[#9AFF00]/30 bg-[#9AFF00]/10 px-3 py-2 text-xs text-zinc-100">
                    <BadgeCheck className="size-4 text-[#9AFF00]" />
                    {badge.title}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              <Metric label="TDS Rating" value={player.rating} />
              <Metric label="Max Rating" value={player.peakRating} />
              <Metric label="Title" value={player.ratingTitle} />
              <Metric label="Current Rank" value={player.currentRank || "N/A"} />
              <Metric label="Monthly Rank" value={player.monthlyRank || "N/A"} />
              <Metric label="Yearly Rank" value={player.yearlyRank || "N/A"} />
              <Metric label="Best Rank" value={player.bestPlacement || "N/A"} />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <div className="certificate-frame clip-arena p-5">
            <p className="engraved text-xs">Rating Card</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl uppercase text-[#9AFF00]">{player.rating}</h2>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl uppercase text-white">{player.ratingTitle}</p>
            <p className="mt-3 text-sm text-zinc-400">Peak rating {player.peakRating}. Titles are recalculated from finalized contest performance.</p>
          </div>
          <div className="section-band p-5">
            <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase">Title History</h2>
            <div className="mt-4 grid gap-2">
              {player.titleHistory.length ? player.titleHistory.map((title) => (
                <div key={title.id} className="ledger-row">
                  <span className="text-[#F3C55B]">{title.title}</span>
                  <span>{title.rating}</span>
                  <span className="ml-auto text-zinc-500">{formatDateUTC(title.earnedAt)}</span>
                </div>
              )) : <p className="text-sm text-zinc-500">No title transitions yet.</p>}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Gauge className="size-5" />} label="Contests" value={player.participationCount} />
          <Metric icon={<Zap className="size-5" />} label="Total Solves" value={player.solved} />
          <Metric icon={<Trophy className="size-5" />} label="Championship Points" value={player.totalScore} />
          <Metric icon={<Crown className="size-5" />} label="Wins" value={player.wins} />
          <Metric icon={<Flame className="size-5" />} label="Podiums" value={player.podiums} />
          <Metric icon={<BarChart3 className="size-5" />} label="First Solves" value={player.firstSolves} />
          <Metric label="Winrate" value={`${player.winrate}%`} />
          <Metric label="Average Rank" value={player.averagePlacement || "N/A"} />
          <Metric label="Best Rank" value={player.bestPlacement || "N/A"} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <ChartPanel title="Rating Progression" data={ratingChart} />
          <ChartPanel title="Score Progression" data={scoreChart} />
          <ChartPanel title="Placement History" data={placementChart.length ? placementChart : [{ contest: "Base", score: 0 }]} />
        </section>

        <section className="section-band mt-6 p-5">
          <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase">Contest History</h2>
          {player.history.length ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  <tr><th className="px-3 py-2">Contest</th><th className="px-3 py-2">Rank</th><th className="px-3 py-2">Solved</th><th className="px-3 py-2">Problems</th><th className="px-3 py-2">Penalty</th><th className="px-3 py-2">Raw Score</th><th className="px-3 py-2">Contest Score</th><th className="px-3 py-2">Bonus</th><th className="px-3 py-2">Final Score</th><th className="px-3 py-2">Rating</th></tr>
                </thead>
                <tbody>
                  {player.history.map(({ contest, entry }: PlayerHistoryItem) => (
                    <tr key={contest.id} className="border-t border-white/10">
                      <td className="px-3 py-3 font-[family-name:var(--font-display)] text-white">{contest.title}</td>
                      <td className="px-3 py-3">#{entry.rank}</td>
                      <td className="px-3 py-3">{entry.solved}</td>
                      <td className="px-3 py-3">{entry.solvedProblems.join(", ") || "None"}</td>
                      <td className="px-3 py-3">{entry.penalty}</td>
                      <td className="px-3 py-3">{entry.rawScore}</td>
                      <td className="px-3 py-3">{entry.contestScore}</td>
                      <td className="px-3 py-3 text-[#F3C55B]">+{entry.bonusPoints}</td>
                      <td className="px-3 py-3 font-[family-name:var(--font-display)] text-[#9AFF00]">{entry.finalScore}</td>
                      <td className="px-3 py-3 text-[#8E2BFF]">{player.ratingDeltaHistory.find((rating) => rating.contestId === contest.id)?.delta ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-5 text-sm text-zinc-500">No contest history recorded yet.</p>}
        </section>

        <section className="section-band mt-6 p-5">
          <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase">Achievement Showcase</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {player.achievements.length ? player.achievements.map((achievement) => (
              <div key={achievement.id} className="clip-arena border border-[#9AFF00]/20 bg-black/45 p-4">
                <BadgeCheck className="size-5 text-[#9AFF00]" />
                <p className="mt-3 font-[family-name:var(--font-display)] text-lg uppercase text-white">{achievement.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{achievement.description ?? "Permanent TDS achievement."}</p>
              </div>
            )) : <p className="text-sm text-zinc-500">No achievements earned yet.</p>}
          </div>
        </section>

        <section className="section-band mt-6 p-5">
          <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase">First Solve History</h2>
          <div className="mt-5 grid gap-3">
            {player.firstSolveHistory.length ? player.firstSolveHistory.map((firstSolve) => (
              <div key={firstSolve.id} className="ledger-row">
                <span className="font-[family-name:var(--font-display)] text-white">{firstSolve.contest.title}</span>
                <span className="text-zinc-500">Problem {firstSolve.problemCode}</span>
                <span className="ml-auto text-[#9AFF00]">{formatDateUTC(firstSolve.createdAt)}</span>
              </div>
            )) : <p className="text-sm text-zinc-500">No first solve history recorded yet.</p>}
          </div>
        </section>
      </main>
    </>
  );
}

function Metric({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="clip-arena border border-[#c0c0c0]/15 bg-black/50 p-4">
      <div className="text-[#9AFF00]">{icon}</div>
      <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="font-[family-name:var(--font-display)] text-2xl text-white">{value}</p>
    </div>
  );
}

function ChartPanel({ title, data }: { title: string; data: { contest: string; score: number }[] }) {
  return (
    <div className="section-band p-5">
      <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase">{title}</h2>
      <div className="mt-4 h-72"><PlayerChart data={data} /></div>
    </div>
  );
}
