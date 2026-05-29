import Link from "next/link";
import { Code2, Crown, ScanSearch } from "lucide-react";
import { yearLabel } from "@/lib/labels";
import type { ContestEntry, LeaderboardRow } from "@/lib/types";

type Props =
  | { type: "contest"; rows: ContestEntry[] }
  | { type: "aggregate"; rows: LeaderboardRow[] };

const headings = ["Rank", "Full Name", "Username", "Year", "Total Score", "Contests", "Wins", "Solved", "First Solves", "Average Placement"];

export function LeaderboardTable(props: Props) {
  const rows =
    props.type === "contest"
      ? props.rows.map((row) => ({
          rank: row.rank,
          fullName: row.fullName,
          username: row.username,
          year: row.year,
          totalScore: row.finalScore,
          contests: 1,
          wins: row.rank === 1 ? 1 : 0,
          solved: row.solved,
          firstSolves: row.firstSolves,
          averagePlacement: row.rank,
        }))
      : props.rows;

  return (
    <div className="tournament-board overflow-hidden">
      <div className="relative flex items-center justify-between border-b border-[#c0c0c0]/15 bg-black/45 px-4 py-4">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#9AFF00] to-transparent" />
        <div className="flex items-center gap-3 certificate-title text-sm text-[#9AFF00]">
          <Crown className="size-4 drop-shadow-[0_0_10px_#9AFF00]" />
          Official Ranking Ledger
        </div>
        <div className="hidden items-center gap-2 border border-[#8E2BFF]/30 bg-[#8E2BFF]/10 px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs text-zinc-400 sm:flex">
          <ScanSearch className="size-3.5 text-[#8E2BFF]" />
          VERIFIED STANDINGS
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-separate border-spacing-y-1 px-2 pb-2 text-left text-sm">
          <thead className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-[#c0c0c0]">
            <tr>
              {headings.map((heading) => (
                <th key={heading} className="px-4 py-3">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.username} className="score-row group outline outline-1 outline-[#c0c0c0]/10 transition duration-300 hover:bg-[#9AFF00]/10 hover:outline-[#9AFF00]/45 hover:shadow-[0_0_24px_rgba(154,255,0,.12)]">
                <td className="px-4 py-3 font-[family-name:var(--font-display)] text-[#F3C55B]">
                  <span className="inline-flex items-center gap-2"><Code2 className="size-3.5" />#{row.rank}</span>
                </td>
                <td className="px-4 py-3 font-semibold text-white">{row.fullName}</td>
                <td className="px-4 py-3">
                  <Link href={`/players/${row.username}`} className="font-[family-name:var(--font-display)] font-semibold uppercase text-zinc-200 transition group-hover:text-[#9AFF00]">
                    {row.username}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-300">{yearLabel(row.year ?? 1)}</td>
                <td className="px-4 py-3 font-[family-name:var(--font-display)] text-lg font-bold text-[#9AFF00] drop-shadow-[0_0_10px_#9AFF00]">{row.totalScore}</td>
                <td className="px-4 py-3">{row.contests}</td>
                <td className="px-4 py-3 text-[#F3C55B]">{row.wins}</td>
                <td className="px-4 py-3">{row.solved}</td>
                <td className="px-4 py-3 text-[#8E2BFF]">{row.firstSolves}</td>
                <td className="px-4 py-3">{row.averagePlacement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
