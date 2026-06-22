import Link from "next/link";
import { Crown, Sparkles, Trophy } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { HallOfFameShowcase } from "@/components/hall-of-fame-showcase";
import { Nav } from "@/components/nav";
import { yearlyLeaderboard } from "@/lib/leaderboards";

export const revalidate = 120;

export default async function HallOfFamePage() {
  const activeYear = new Date().getUTCFullYear();
  const board = await yearlyLeaderboard(activeYear);
  const champions = board.rows.filter((row) => row.wins > 0 || row.rank <= 5);

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
          <p className="engraved text-xs">Immortal Archive</p>
          <h1 data-text="Hall of Fame" className="glitch certificate-title mt-2 text-6xl">Hall of Fame</h1>
          <p className="mt-3 max-w-2xl font-[family-name:var(--font-mono)] text-zinc-400">
            Champions, finalists, first-solve specialists, and season-defining performers from finalized contests.
          </p>
        </section>

        <section className="mt-8">
          <HallOfFameShowcase rows={board.rows} />
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {champions.length ? champions.map((player) => (
            <Link key={player.username} href={`/players/${player.username}`} className="certificate-frame clip-arena p-5 transition hover:-translate-y-1 hover:border-[#9AFF00]/50">
              <Trophy className="size-8 text-[#F3C55B] drop-shadow-[0_0_14px_#F3C55B]" />
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-zinc-500">Rank #{player.rank}</p>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl uppercase text-white">{player.fullName}</h2>
              <p className="font-[family-name:var(--font-mono)] text-[#9AFF00]">@{player.username}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Score" value={player.totalScore} />
                <MiniStat label="Wins" value={player.wins} />
                <MiniStat label="Firsts" value={player.firstSolves} />
              </div>
            </Link>
          )) : (
            <div className="empty-plaque clip-arena p-8 text-center md:col-span-3">
              <Crown className="mx-auto size-10 text-[#9AFF00]" />
              <p className="certificate-title mt-3 text-3xl text-[#9AFF00]">No laureates yet</p>
              <p className="mt-2 text-zinc-400">Finalize a contest to engrave the first champions.</p>
            </div>
          )}
        </section>

        <section className="section-band mt-8 p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="size-5 text-[#9AFF00]" />
            <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase">Recognition Rules</h2>
          </div>
          <p className="mt-4 font-[family-name:var(--font-mono)] text-zinc-400">
            Hall entries are rebuilt from finalized standings, yearly rank, wins, solved count, first solves, and top-five prize performance.
          </p>
        </section>
      </main>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="clip-arena border border-[#c0c0c0]/15 bg-black/45 p-3">
      <p className="font-[family-name:var(--font-display)] text-lg text-[#9AFF00]">{value}</p>
      <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
    </div>
  );
}
