import { Code2, RadioTower, Trophy } from "lucide-react";
import { getContestLabel } from "@/lib/labels";
import type { ContestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ContestStatus }) {
  const Icon = status === "LIVE" ? RadioTower : status === "COMPLETED" ? Trophy : Code2;
  return (
    <span
      className={cn(
        "clip-arena inline-flex items-center gap-2 border px-3 py-1.5 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.22em] shadow-[inset_0_0_18px_rgba(255,255,255,.04)]",
        status === "LIVE" && "border-[#9AFF00]/70 bg-[#9AFF00]/10 text-[#9AFF00]",
        status === "COMPLETED" && "border-[#8E2BFF]/70 bg-[#8E2BFF]/10 text-purple-100",
        status === "UPCOMING" && "border-zinc-500/60 bg-zinc-900/70 text-zinc-300",
      )}
    >
      <Icon className="size-3.5" />
      {getContestLabel(status)}
    </span>
  );
}
