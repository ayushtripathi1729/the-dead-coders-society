import { Award, Bolt, Crown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Nav } from "@/components/nav";
import { Podium } from "@/components/podium";
import { yearlyLeaderboard } from "@/lib/leaderboards";

export const revalidate = 60;

type YearlyStat = { Icon: LucideIcon; label: string; name?: string; value?: number };

export default async function YearlyPage() {
  const activeYear = new Date().getUTCFullYear();
  const board = await yearlyLeaderboard(activeYear);
  const top = board.rows[0];
  const mostWins = [...board.rows].sort((a, b) => b.wins - a.wins)[0];
  const firsts = [...board.rows].sort((a, b) => b.firstSolves - a.firstSolves)[0];
  const stats: YearlyStat[] = [
    { Icon: Crown, label: "Highest Scorer", name: top?.fullName, value: top?.totalScore },
    { Icon: Award, label: "Most Contest Wins", name: mostWins?.fullName, value: mostWins?.wins },
    { Icon: Bolt, label: "Most Problem Firsts", name: firsts?.fullName, value: firsts?.firstSolves },
  ];

  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6">
        <section className="certificate-frame ornate-corners p-6">
          <span className="corner corner-tl" />
          <span className="corner corner-tr" />
          <span className="corner corner-bl" />
          <span className="corner corner-br" />
          <p className="engraved text-xs">Year Selector: {activeYear}</p>
          <h1 data-text="Yearly Championship" className="glitch certificate-title mt-2 text-6xl">Yearly Championship</h1>
          <p className="mt-3 max-w-2xl font-[family-name:var(--font-mono)] text-zinc-400">The annual championship ledger of the underworld arena. Total score, wins, solved count, first strikes, and penalty discipline decide the throne.</p>
        </section>
        <div className="mt-8">{board.rows.length ? <Podium rows={board.rows} /> : <div className="empty-plaque clip-arena p-8 text-center"><p className="certificate-title text-3xl text-[#9AFF00]">No yearly rankings</p><p className="mt-2 text-zinc-400">Complete contests will build the championship wall.</p></div>}</div>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {stats.map(({ Icon, label, name, value }: YearlyStat) => (
            <div key={label} className="certificate-frame clip-arena p-5">
              <Icon className="size-8 text-[#F3C55B] drop-shadow-[0_0_14px_#F3C55B]" />
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">{name}</p>
              <p className="font-[family-name:var(--font-mono)] text-[#9AFF00]">{value}</p>
            </div>
          ))}
        </section>
        <div className="mt-8">{board.rows.length ? <LeaderboardTable type="aggregate" rows={board.rows} /> : null}</div>
      </main>
    </>
  );
}
