"use client";

import { useEffect, useState } from "react";

export function Countdown({ target }: { target: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(target).getTime() - Date.now()));
    const kickoff = window.setTimeout(update, 0);
    const timer = window.setInterval(() => {
      update();
    }, 1000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, [target]);

  const safeRemaining = remaining ?? 0;
  const days = Math.floor(safeRemaining / 86_400_000);
  const hours = Math.floor((safeRemaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((safeRemaining % 3_600_000) / 60_000);
  const seconds = Math.floor((safeRemaining % 60_000) / 1000);

  return (
    <div className="grid grid-cols-4 gap-2" suppressHydrationWarning>
      {[
        ["D", days],
        ["H", hours],
        ["M", minutes],
        ["S", seconds],
      ].map(([label, value]) => (
        <div key={label} className="clip-arena border border-[#9AFF00]/20 bg-black/55 p-3 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl text-[#9AFF00]">{remaining === null ? "--" : String(value).padStart(2, "0")}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        </div>
      ))}
    </div>
  );
}
