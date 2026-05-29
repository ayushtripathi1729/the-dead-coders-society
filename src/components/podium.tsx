"use client";

import { motion } from "framer-motion";
import { Code2, Crown, Medal, Trophy } from "lucide-react";
import type { LeaderboardRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const podiumOrder = [1, 0, 2];
const styles = [
  "rank-gold border-[#F3C55B]/80 min-h-80 md:scale-105",
  "rank-silver border-[#C0C0C0]/80 min-h-64",
  "rank-bronze border-[#CD7F32]/80 min-h-56",
];

export function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const top = rows.slice(0, 3);
  return (
    <div className="grid items-end gap-5 md:grid-cols-3">
      {podiumOrder.map((sourceIndex, visualIndex) => {
        const row = top[sourceIndex];
        if (!row) return null;
        const Icon = sourceIndex === 0 ? Crown : sourceIndex === 1 ? Trophy : Medal;
        return (
          <motion.div
            key={row.username}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: visualIndex * 0.1, type: "spring" }}
            whileHover={{ y: -8, scale: sourceIndex === 0 ? 1.06 : 1.02 }}
            className={cn("certificate-frame clip-obelisk group overflow-hidden p-5", styles[sourceIndex])}
          >
            <span className="corner corner-tl" />
            <span className="corner corner-tr" />
            <span className="corner corner-bl" />
            <span className="corner corner-br" />
            <div className="absolute inset-0 bg-black/55 transition group-hover:bg-black/42" />
            <div className="absolute -right-10 -top-10 size-44 rounded-full bg-current opacity-20 blur-3xl transition group-hover:opacity-30" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <Icon className="size-10 drop-shadow-[0_0_18px_currentColor]" />
                <Code2 className="size-7 text-white/45 drop-shadow-[0_0_14px_currentColor]" />
              </div>
              <div className="my-8 text-center">
                <p className="font-[family-name:var(--font-gothic)] text-7xl font-bold leading-none drop-shadow-[0_0_18px_currentColor]">#{row.rank}</p>
                <div className="mx-auto mt-4 h-px w-2/3 bg-current shadow-[0_0_16px_currentColor]" />
              </div>
              <div>
                <h3 className="truncate font-[family-name:var(--font-display)] text-2xl uppercase text-white">{row.fullName}</h3>
                <p className="truncate text-sm text-zinc-300">@{row.username}</p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-4xl font-bold">{row.totalScore}</p>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">{row.wins} wins / {row.solved} solved</p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
