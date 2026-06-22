"use client";

import { useMemo, useState } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import type { LeaderboardRow } from "@/lib/types";

const sorts = ["points", "rating", "wins", "podiums", "firsts", "contests"] as const;
type SortKey = typeof sorts[number];

export function SortableLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const [sort, setSort] = useState<SortKey>("points");
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {sorts.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSort(item)}
            className={`upload-action-button ${sort === item ? "border-[#9AFF00]/70 text-[#9AFF00]" : ""}`}
          >
            {item}
          </button>
        ))}
      </div>
      <LeaderboardTable type="aggregate" rows={sorted} />
    </>
  );
}

function sortRows(rows: LeaderboardRow[], sort: SortKey) {
  return [...rows].sort((a, b) => {
    if (sort === "rating") return b.rating - a.rating || a.rank - b.rank;
    if (sort === "wins") return b.wins - a.wins || a.rank - b.rank;
    if (sort === "podiums") return b.podiums - a.podiums || a.rank - b.rank;
    if (sort === "firsts") return b.firstSolves - a.firstSolves || a.rank - b.rank;
    if (sort === "contests") return b.contests - a.contests || a.rank - b.rank;
    return a.rank - b.rank;
  });
}
