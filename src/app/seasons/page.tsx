import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Crown, Trophy } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { Nav } from "@/components/nav";
import { getSeasons } from "@/lib/ecosystem";
import { formatDateUTC } from "@/lib/utils";

export const revalidate = 120;

export default async function SeasonsPage() {
  const seasons = await getSeasons();
  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6">
        <section className="certificate-frame ornate-corners p-6">
          <span className="corner corner-tl" /><span className="corner corner-tr" /><span className="corner corner-bl" /><span className="corner corner-br" />
          <p className="engraved text-xs">TDS Seasons</p>
          <h1 className="certificate-title mt-2 text-5xl text-white sm:text-7xl">Seasons</h1>
          <p className="mt-3 max-w-2xl font-[family-name:var(--font-mono)] text-zinc-400">Season standings, champions, team standings, and contest contributions.</p>
        </section>
        <section className="mt-6 grid gap-6">
          {seasons.map((season) => {
            const champion = season.standings[0];
            const mvp = [...season.standings].sort((a, b) => b.solved - a.solved || b.points - a.points)[0];
            return (
              <div key={season.id} className="section-band p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <p className="engraved text-xs">{formatDateUTC(season.startsAt)} - {formatDateUTC(season.endsAt)}</p>
                    <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl uppercase text-white">{season.name}</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric icon={<Crown className="size-4" />} label="Champion" value={champion ? `@${champion.playerUsername}` : "TBD"} />
                    <Metric icon={<Trophy className="size-4" />} label="MVP" value={mvp ? `@${mvp.playerUsername}` : "TBD"} />
                    <Metric icon={<CalendarDays className="size-4" />} label="Contests" value={season.contests.length} />
                  </div>
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        <tr><th className="px-3 py-2">Rank</th><th className="px-3 py-2">Player</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Points</th><th className="px-3 py-2">Contests</th><th className="px-3 py-2">Wins</th><th className="px-3 py-2">Solved</th></tr>
                      </thead>
                      <tbody>
                        {season.standings.map((row) => (
                          <tr key={row.id} className="border-t border-white/10">
                            <td className="px-3 py-3">#{row.rank}</td>
                            <td className="px-3 py-3"><Link href={`/players/${row.playerUsername}`} className="text-white hover:text-[#9AFF00]">{row.player.fullName}</Link></td>
                            <td className="px-3 py-3 text-[#F3C55B]">{row.player.ratingTitle}</td>
                            <td className="px-3 py-3 text-[#9AFF00]">{row.points}</td>
                            <td className="px-3 py-3">{row.contests}</td>
                            <td className="px-3 py-3">{row.wins}</td>
                            <td className="px-3 py-3">{row.solved}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!season.standings.length && <p className="mt-4 text-sm text-zinc-500">No season standings yet.</p>}
                  </div>
                  <div className="grid gap-3">
                    <p className="font-[family-name:var(--font-display)] text-sm uppercase tracking-[0.18em] text-white">Season Contests</p>
                    {season.contests.map((contest) => (
                      <Link key={contest.id} href={`/contests/${contest.slug}`} className="ledger-row">
                        <span>{contest.title}</span>
                        <span className="ml-auto text-zinc-500">{formatDateUTC(contest.startTime)}</span>
                      </Link>
                    ))}
                    {!season.contests.length && <p className="text-sm text-zinc-500">No contests assigned yet.</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="clip-arena border border-[#c0c0c0]/15 bg-black/45 p-3">
      <div className="text-[#9AFF00]">{icon}</div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="truncate font-[family-name:var(--font-display)] text-lg text-white">{value}</p>
    </div>
  );
}
