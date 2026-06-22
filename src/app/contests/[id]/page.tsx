import { notFound } from "next/navigation";
import Image from "next/image";
import { Calendar, Gauge, Mail, Phone, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Nav } from "@/components/nav";
import { StatusBadge } from "@/components/status-badge";
import { getContest } from "@/lib/leaderboards";
import type { ContestView } from "@/lib/types";
import { formatDateUTC } from "@/lib/utils";

export const revalidate = 60;

type ContestStat = { Icon: LucideIcon; label: string; value: string };
type ContestProblemView = ContestView["problems"][number];
type ContestCoordinatorView = ContestView["coordinators"][number];

export default async function ContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contest = await getContest(id);
  if (!contest) notFound();
  const bannerPoster = contest.bannerPoster || contest.contestBanner || "/deadcoders/poster2.png";
  const stats: ContestStat[] = [
    { Icon: Calendar, label: "Starts", value: formatDateUTC(contest.startTime) },
    { Icon: Gauge, label: "Total", value: `${contest.totalPoints} pts` },
    { Icon: Trophy, label: "Winner", value: contest.entries[0]?.fullName ?? "TBD" },
  ];

  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6">
        <section className="certificate-frame ornate-corners clip-arena overflow-hidden">
          <span className="corner corner-tl" />
          <span className="corner corner-tr" />
          <span className="corner corner-bl" />
          <span className="corner corner-br" />
          <div className="grid lg:grid-cols-[.95fr_1.05fr]">
            <div className="relative min-h-96 overflow-hidden">
              <Image
                src={bannerPoster}
                alt={`${contest.title} banner`}
                fill
                priority
                sizes="(min-width: 1024px) 48vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.08),rgba(0,0,0,.84))]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent,rgba(142,43,255,.3)_62%,rgba(0,0,0,.85))]" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-[#9AFF00] shadow-[0_0_24px_#9AFF00]" />
            </div>
            <div className="p-6 md:p-10">
              <StatusBadge status={contest.status} />
              <h1 data-text={contest.title} className="glitch certificate-title mt-5 text-6xl">{contest.title}</h1>
              <div className="purple-ribbon mt-3">
                <span className="font-[family-name:var(--font-display)] text-xl uppercase text-white">{contest.platform}</span>
              </div>
              <p className="mt-4 font-[family-name:var(--font-mono)] text-lg text-zinc-300">{contest.description}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {stats.map(({ Icon, label, value }: ContestStat) => (
                  <div key={label} className="clip-arena border border-[#9AFF00]/20 bg-black/50 p-4 shadow-[inset_0_0_20px_rgba(154,255,0,.04)]">
                    <Icon className="size-5 text-[#9AFF00] drop-shadow-[0_0_12px_#9AFF00]" />
                    <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
                    <p className="font-[family-name:var(--font-display)] text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <div className="mt-8">
          {contest.entries.length ? <LeaderboardTable type="contest" rows={contest.entries} /> : (
            <div className="empty-plaque clip-arena p-8 text-center">
              <p className="certificate-title text-3xl text-[#9AFF00]">No standings available</p>
              <p className="mt-2 text-zinc-400">Standings will appear after Codeforces sync or private standings upload.</p>
            </div>
          )}
        </div>
        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="section-band p-5">
            <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase">Winners</h2>
            <div className="mt-4 grid gap-3">
              {contest.entries.slice(0, 3).map((entry) => (
                <div key={entry.username} className="ledger-row"><span>#{entry.rank}</span><span>{entry.fullName}</span><span className="ml-auto text-[#9AFF00]">{entry.bonusPoints} pts</span></div>
              ))}
            </div>
          </div>
          <div className="section-band p-5">
            <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase">First Solves</h2>
            <div className="mt-4 grid gap-3">
              {contest.problems.map((problem: ContestProblemView) => {
                const firstSolve = problem.firstSolves[0];
                const solver = firstSolve?.status === "ASSIGNED" && firstSolve.player ? `@${firstSolve.player.username}` : "UNSOLVED";
                return (
                  <div key={problem.id} className="ledger-row">
                    <span className="font-[family-name:var(--font-display)] text-[#F3C55B]">Problem {problem.code}</span>
                    <span>{problem.title || `${problem.points} pts`}</span>
                    <span className="ml-auto text-[#9AFF00]">{solver}</span>
                  </div>
                );
              })}
              {!contest.problems.length && <p className="text-sm text-zinc-500">No contest problems recorded.</p>}
            </div>
          </div>
          <div className="section-band p-5">
            <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase">Editorial Archive</h2>
            {contest.contestLink ? <a href={contest.contestLink} className="mt-4 block text-[#9AFF00] underline underline-offset-4">Open official contest</a> : <p className="mt-4 text-sm text-zinc-500">Contest link not published yet.</p>}
          </div>
        </section>
        <section className="section-band mt-8 p-5">
          <div className="flex items-center gap-3">
            <Users className="size-5 text-[#9AFF00]" />
            <h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase">Coordinators</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {contest.coordinators.length ? contest.coordinators.map((coordinator: ContestCoordinatorView) => (
              <div key={coordinator.id} className="clip-arena border border-[#9AFF00]/20 bg-black/50 p-4 shadow-[0_0_28px_rgba(154,255,0,.06)]">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-full border border-[#9AFF00]/35 bg-[#9AFF00]/10 font-[family-name:var(--font-display)] text-[#9AFF00]">
                    {coordinator.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-lg uppercase text-white">{coordinator.name}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{coordinator.role}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-zinc-300">
                  {coordinator.email && <a className="inline-flex items-center gap-2 text-[#9AFF00]" href={`mailto:${coordinator.email}`}><Mail className="size-4" /> {coordinator.email}</a>}
                  <a className="inline-flex items-center gap-2" href={`tel:${coordinator.phone}`}><Phone className="size-4 text-[#9AFF00]" /> {coordinator.phone}</a>
                  {coordinator.discord && <p className="text-zinc-400">Discord: {coordinator.discord}</p>}
                </div>
              </div>
            )) : <p className="text-sm text-zinc-500">Coordinator details will appear when published.</p>}
          </div>
        </section>
      </main>
    </>
  );
}
