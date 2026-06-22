import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Nav } from "@/components/nav";
import { Podium } from "@/components/podium";
import { StatusBadge } from "@/components/status-badge";
import { monthlyLeaderboard } from "@/lib/leaderboards";
import type { LeaderboardRow } from "@/lib/types";

export const revalidate = 60;

export default async function MonthlyPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; sort?: string }> }) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year ?? now.getUTCFullYear());
  const month = Number(params.month ?? now.getUTCMonth() + 1);
  const board = await monthlyLeaderboard(year, month);
  const rows = sortRows(board.rows, params.sort);

  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6">
        <div className="certificate-frame ornate-corners mb-5 flex flex-col justify-between gap-4 p-6 md:flex-row md:items-end">
          <span className="corner corner-tl" />
          <span className="corner corner-tr" />
          <span className="corner corner-bl" />
          <span className="corner corner-br" />
          <div>
            <p className="engraved text-xs">Month Selector: {month}/{year}</p>
            <h1 data-text="Monthly Rankings" className="glitch certificate-title mt-2 text-6xl">Monthly Rankings</h1>
          </div>
          <div className="flex gap-2">
            {[month, Math.max(1, month - 1), Math.max(1, month - 2)].map((item) => (
              <Link key={item} href={`/leaderboards/monthly?year=${year}&month=${item}`} className="clip-arena border border-[#8E2BFF]/35 bg-black/50 px-4 py-2 font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.18em] hover:border-[#9AFF00]/70 hover:text-[#9AFF00]">
                {item}/{year}
              </Link>
            ))}
          </div>
        </div>
        {board.rows.length ? <Podium rows={board.rows} /> : (
          <div className="empty-plaque clip-arena p-8 text-center">
            <p className="certificate-title text-3xl text-[#9AFF00]">No rankings available</p>
            <p className="mt-2 text-zinc-400">This month has no uploaded standings yet.</p>
          </div>
        )}
        <div className="mt-8">
          {board.rows.length ? (
            <>
              <SortBar base={`/leaderboards/monthly?year=${year}&month=${month}`} />
              <LeaderboardTable type="aggregate" rows={rows} />
            </>
          ) : null}
        </div>
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {board.contests.map((contest) => (
            <Link href={`/contests/${contest.slug}`} key={contest.id} className="certificate-frame clip-arena p-5 transition hover:-translate-y-1 hover:border-[#9AFF00]/40">
              <CalendarDays className="size-6 text-[#8E2BFF] drop-shadow-[0_0_14px_#8E2BFF]" />
              <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl uppercase">{contest.title}</h2>
              <div className="mt-4"><StatusBadge status={contest.status} /></div>
              {contest.entries[0] ? <p className="mt-3 text-sm text-zinc-400">Winner: <span className="text-[#9AFF00]">{contest.entries[0].fullName}</span></p> : <p className="mt-3 text-sm text-zinc-500">No standings yet</p>}
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}

function sortRows(rows: LeaderboardRow[], sort = "points") {
  return [...rows].sort((a, b) => {
    if (sort === "rating") return b.rating - a.rating || a.rank - b.rank;
    if (sort === "wins") return b.wins - a.wins || a.rank - b.rank;
    if (sort === "podiums") return b.podiums - a.podiums || a.rank - b.rank;
    if (sort === "firsts") return b.firstSolves - a.firstSolves || a.rank - b.rank;
    if (sort === "contests") return b.contests - a.contests || a.rank - b.rank;
    return a.rank - b.rank;
  });
}

function SortBar({ base }: { base: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {["points", "rating", "wins", "podiums", "firsts", "contests"].map((sort) => (
        <Link key={sort} href={`${base}&sort=${sort}`} className="upload-action-button">{sort}</Link>
      ))}
    </div>
  );
}
