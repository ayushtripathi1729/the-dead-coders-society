import Link from "next/link";
import { Code2 } from "lucide-react";

export function Nav() {
  const links = [
    ["Contests", "/contests"],
    ["Players", "/players"],
    ["Academy", "/academy"],
    ["Seasons", "/seasons"],
    ["Teams", "/teams"],
    ["Monthly", "/leaderboards/monthly"],
    ["Yearly", "/leaderboards/yearly"],
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#9AFF00]/15 bg-black/70 shadow-[0_0_38px_rgba(142,43,255,.18)] backdrop-blur-xl">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#9AFF00] to-transparent opacity-70" />
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="clip-obelisk flex size-11 items-center justify-center border border-[#9AFF00]/50 bg-[#9AFF00]/10 text-[#9AFF00] toxic-glow">
            <Code2 className="size-5" />
          </span>
          <span className="font-[family-name:var(--font-gothic)] text-xs font-bold uppercase tracking-[0.24em] text-white neon-text sm:text-sm">
            The Dead Coders Society
          </span>
        </Link>
        <div className="hidden items-center gap-5 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-zinc-400 lg:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="relative transition hover:text-[#9AFF00] hover:drop-shadow-[0_0_10px_#9AFF00]">
              {label}
            </Link>
          ))}
        </div>
        <div className="hidden border border-[#9AFF00]/20 bg-[#9AFF00]/5 px-3 py-2 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-[#9AFF00] sm:block">
          Championship Portal
        </div>
      </nav>
    </header>
  );
}
