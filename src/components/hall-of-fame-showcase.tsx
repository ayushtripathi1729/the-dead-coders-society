"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, ChevronLeft, ChevronRight, Sparkles, Trophy } from "lucide-react";
import { yearLabel } from "@/lib/labels";
import type { LeaderboardRow } from "@/lib/types";

export function HallOfFameShowcase({ rows }: { rows: LeaderboardRow[] }) {
  const champions = useMemo(() => rows.filter((row) => row.wins > 0 || row.rank <= 5).slice(0, 8), [rows]);
  const [index, setIndex] = useState(0);
  const champion = champions[index];

  useEffect(() => {
    if (champions.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % champions.length), 15000);
    return () => window.clearInterval(timer);
  }, [champions.length]);

  if (!champion) {
    return (
      <div className="empty-plaque clip-arena p-8 text-center">
        <p className="certificate-title text-2xl text-[#9AFF00]">Hall sealed</p>
        <p className="mt-2 text-sm text-zinc-400">Completed contest winners will be engraved here.</p>
      </div>
    );
  }

  return (
    <div className="plaque-stage relative overflow-hidden p-5 sm:p-7">
      <AnimatePresence mode="wait">
        <motion.div
          key={champion.username}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="grid items-center gap-6 md:grid-cols-[.78fr_1.22fr]"
        >
          <div className="trophy-seal rating-seal mx-auto flex aspect-square w-full max-w-72 items-center justify-center">
            <Trophy className="size-28 text-[#F3C55B] drop-shadow-[0_0_30px_rgba(243,197,91,.75)]" />
          </div>
          <div>
            <p className="engraved text-xs">Society Laureate #{champion.rank}</p>
            <h3 className="certificate-title mt-2 text-4xl text-white sm:text-6xl">{champion.fullName}</h3>
            <Link href={`/players/${champion.username}`} className="mt-2 block font-[family-name:var(--font-display)] text-xl uppercase text-[#9AFF00]">
              @{champion.username}
            </Link>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-zinc-300">{yearLabel(champion.year)} / Title Earned: Grand Finalist</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {[
                ["Total Score", champion.totalScore],
                ["Wins", champion.wins],
                ["Solved", champion.solved],
                ["First Solves", champion.firstSolves],
              ].map(([label, value]) => (
                <div key={String(label)} className="clip-arena border border-[#c0c0c0]/15 bg-black/45 p-4">
                  <p className="font-[family-name:var(--font-display)] text-2xl text-[#9AFF00]">{value}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Champion", "Elite Rating", "Archive Immortal"].map((badge) => (
                <span key={badge} className="clip-arena inline-flex items-center gap-2 border border-[#F3C55B]/35 bg-[#F3C55B]/10 px-3 py-2 text-xs uppercase tracking-[0.14em] text-[#F3C55B]">
                  {badge === "Elite Rating" ? <Sparkles className="size-4" /> : <BadgeCheck className="size-4" />}
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      {champions.length > 1 && (
        <div className="mt-5 flex justify-end gap-2">
          <button aria-label="Previous champion" className="icon-control" onClick={() => setIndex((current) => (current - 1 + champions.length) % champions.length)}>
            <ChevronLeft className="size-4" />
          </button>
          <button aria-label="Next champion" className="icon-control" onClick={() => setIndex((current) => (current + 1) % champions.length)}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
