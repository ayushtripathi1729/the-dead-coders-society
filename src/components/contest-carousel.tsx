"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, UserRound, Users } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { ContestView } from "@/lib/types";
import { formatDateUTC } from "@/lib/utils";

export function ContestCarousel({ contests }: { contests: ContestView[] }) {
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const pageCount = Math.max(1, Math.ceil(contests.length / 5));
  const visible = useMemo(() => contests.slice(page * 5, page * 5 + 5), [contests, page]);
  const next = useCallback(() => setPage((current) => (current + 1) % pageCount), [pageCount]);
  const previous = useCallback(() => setPage((current) => (current - 1 + pageCount) % pageCount), [pageCount]);

  useEffect(() => {
    if (paused || pageCount < 2) return;
    const timer = window.setInterval(next, 9000);
    return () => window.clearInterval(timer);
  }, [next, pageCount, paused]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
      onTouchEnd={(event) => {
        if (touchStart === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchStart) - touchStart;
        if (Math.abs(delta) > 42) (delta > 0 ? previous : next)();
        setTouchStart(null);
      }}
    >
      <div className="mb-3 flex justify-end gap-2">
        <button aria-label="Previous contests" className="icon-control" onClick={previous}>
          <ChevronLeft className="size-4" />
        </button>
        <button aria-label="Next contests" className="icon-control" onClick={next}>
          <ChevronRight className="size-4" />
        </button>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
        >
          {visible.map((contest) => (
            <Link key={contest.id} href={`/contests/${contest.slug}`} className="contest-poster-card certificate-frame clip-arena overflow-hidden transition hover:-translate-y-1">
              <div className="relative aspect-[4/5] bg-black">
                <Image
                  src={contest.invitePoster || "/deadcoders/invite.png"}
                  alt={`${contest.title} invite poster`}
                  fill
                  sizes="(min-width: 1536px) 20vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.86))]" />
                <div className="absolute bottom-3 left-3 right-3">
                  <StatusBadge status={contest.status} />
                  <h3 className="mt-3 line-clamp-2 font-[family-name:var(--font-display)] text-lg uppercase text-white">{contest.title}</h3>
                </div>
              </div>
              <div className="grid gap-2 p-4 text-xs text-zinc-400">
                <Meta icon={<CalendarDays className="size-3.5" />} value={formatDateUTC(contest.startTime)} />
                <Meta icon={<Clock className="size-3.5" />} value={`${contest.duration} min / ${contest.platform}`} />
                <Meta icon={<UserRound className="size-3.5" />} value={contest.coordinators[0]?.name || "Control Room"} />
                <Meta icon={<Users className="size-3.5" />} value={`${contest.entries.length} participants`} />
              </div>
            </Link>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Meta({ icon, value }: { icon: ReactNode; value: ReactNode }) {
  return <p className="flex min-w-0 items-center gap-2 uppercase tracking-[0.12em]">{icon}<span className="truncate">{value}</span></p>;
}
