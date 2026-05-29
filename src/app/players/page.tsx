import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, Flame, Search, Trophy, Users, Zap } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { Nav } from "@/components/nav";
import { yearLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const players = await prisma.player.findMany({
    orderBy: [
      { totalScore: "desc" },
      { currentRating: "desc" },
      { wins: "desc" },
      { username: "asc" },
    ],
    select: {
      id: true,
      fullName: true,
      username: true,
      year: true,
      currentRating: true,
      peakRating: true,
      monthlyRank: true,
      yearlyRank: true,
      contestsPlayed: true,
      totalSolved: true,
      totalScore: true,
      wins: true,
      podiums: true,
      firstSolves: true,
    },
  });

  const totals = {
    players: players.length,
    contests: players.reduce((sum, player) => sum + player.contestsPlayed, 0),
    solved: players.reduce((sum, player) => sum + player.totalSolved, 0),
    firstSolves: players.reduce((sum, player) => sum + player.firstSolves, 0),
  };

  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-24 sm:px-6">
        <section className="certificate-frame ornate-corners p-6">
          <span className="corner corner-tl" /><span className="corner corner-tr" /><span className="corner corner-bl" /><span className="corner corner-br" />
          <p className="engraved text-xs">Roster</p>
          <h1 className="certificate-title mt-2 text-5xl text-white sm:text-6xl">Players</h1>
          <p className="mt-3 max-w-2xl font-[family-name:var(--font-mono)] text-zinc-400">Every registered contender with rating, rank, solve, and first-solve records.</p>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RosterMetric icon={<Users className="size-5" />} label="Players" value={totals.players} />
          <RosterMetric icon={<Trophy className="size-5" />} label="Contest Entries" value={totals.contests} />
          <RosterMetric icon={<Zap className="size-5" />} label="Total Solves" value={totals.solved} />
          <RosterMetric icon={<Flame className="size-5" />} label="First Solves" value={totals.firstSolves} />
        </section>

        <section className="section-band mt-5 overflow-hidden p-5">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-[#9AFF00]">
              <Search className="size-5" />
              <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase text-white">Official Roster</h2>
            </div>
            <p className="font-[family-name:var(--font-mono)] text-sm text-zinc-500">{players.length} records</p>
          </div>

          {players.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1080px] border-separate border-spacing-y-2 text-left text-sm">
                <thead className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-[#c0c0c0]">
                  <tr>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Year</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Peak</th>
                    <th className="px-4 py-3">Monthly</th>
                    <th className="px-4 py-3">Yearly</th>
                    <th className="px-4 py-3">Contests</th>
                    <th className="px-4 py-3">Solved</th>
                    <th className="px-4 py-3">Wins</th>
                    <th className="px-4 py-3">First Solves</th>
                    <th className="px-4 py-3">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.id} className="score-row outline outline-1 outline-[#c0c0c0]/10 transition hover:bg-[#9AFF00]/10 hover:outline-[#9AFF00]/45">
                      <td className="px-4 py-3">
                        <Link href={`/players/${player.username}`} className="group inline-flex min-w-0 flex-col">
                          <span className="font-[family-name:var(--font-display)] text-base uppercase text-white transition group-hover:text-[#9AFF00]">{player.fullName}</span>
                          <span className="font-[family-name:var(--font-mono)] text-xs text-zinc-500">@{player.username}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{yearLabel(player.year)}</td>
                      <td className="px-4 py-3 font-[family-name:var(--font-display)] text-[#9AFF00]">{player.currentRating}</td>
                      <td className="px-4 py-3 text-zinc-300">{player.peakRating}</td>
                      <td className="px-4 py-3">{player.monthlyRank ? `#${player.monthlyRank}` : "N/A"}</td>
                      <td className="px-4 py-3">{player.yearlyRank ? `#${player.yearlyRank}` : "N/A"}</td>
                      <td className="px-4 py-3">{player.contestsPlayed}</td>
                      <td className="px-4 py-3">{player.totalSolved}</td>
                      <td className="px-4 py-3 text-[#F3C55B]">{player.wins}</td>
                      <td className="px-4 py-3 text-[#8E2BFF]">{player.firstSolves}</td>
                      <td className="px-4 py-3 font-[family-name:var(--font-display)] text-lg text-[#9AFF00]">{player.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-plaque clip-arena mt-4 p-6 text-center">
              <BadgeCheck className="mx-auto size-8 text-[#9AFF00]" />
              <p className="mt-3 font-[family-name:var(--font-display)] text-sm uppercase text-white">No player records yet</p>
              <p className="mt-1 text-sm text-zinc-500">Add standings from the Control Room to populate the roster.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function RosterMetric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="clip-arena border border-[#c0c0c0]/15 bg-black/55 p-4">
      <div className="text-[#9AFF00]">{icon}</div>
      <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="font-[family-name:var(--font-display)] text-2xl text-white">{value}</p>
    </div>
  );
}
