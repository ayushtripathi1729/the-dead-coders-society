import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, Crown, RadioTower, ShieldCheck, Trophy, Users, Zap } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { Countdown } from "@/components/countdown";
import { HallOfFameShowcase } from "@/components/hall-of-fame-showcase";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Nav } from "@/components/nav";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { listContests, monthlyLeaderboard, yearlyLeaderboard } from "@/lib/leaderboards";
import { formatDateUTC } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const [contests, month, year] = await Promise.all([
    listContests(),
    monthlyLeaderboard(now.getUTCFullYear(), now.getUTCMonth() + 1),
    yearlyLeaderboard(now.getUTCFullYear()),
  ]);
  const liveContest = contests.find((contest) => contest.status === "LIVE");
  const upcomingContest = contests.filter((contest) => contest.status === "UPCOMING").sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  const completedContest = contests.find((contest) => contest.status === "COMPLETED");
  const latestContest = liveContest ?? upcomingContest ?? completedContest;
  const previousContest = contests.find((contest) => contest.status === "COMPLETED" && contest.standingsFinalizedAt && contest.entries.length);
  const upcoming = contests.filter((contest) => contest.status === "UPCOMING").sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 3);
  const winners = contests.filter((contest) => contest.status === "COMPLETED" && contest.standingsFinalizedAt && contest.entries.length).map((contest) => ({ contest, winner: contest.entries[0] })).slice(0, 3);
  const totalSolves = year.rows.reduce((sum, row) => sum + row.solved, 0);

  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-[1500px] px-3 pb-14 pt-20 sm:px-5">
        <section className="poster-hero relative grid min-h-[calc(100vh-5rem)] overflow-hidden border border-[#8E2BFF]/60 lg:grid-cols-[1.05fr_.95fr]">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.88),rgba(0,0,0,.52),rgba(0,0,0,.9))]" />
          <div className="relative z-10 flex flex-col justify-center p-6 sm:p-10 lg:p-14">
            <div className="inline-flex w-fit items-center gap-2 border border-[#9AFF00]/40 bg-black/70 px-4 py-2 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.28em] text-[#9AFF00]">
              <Zap className="size-4" />
              Underground Coding Championship
            </div>
            <p className="certificate-title mt-6 text-3xl sm:text-5xl">THE</p>
            <h1 data-text="DEAD CODERS" className="glitch certificate-title max-w-5xl text-6xl leading-none sm:text-8xl lg:text-[8.8rem]">DEAD CODERS</h1>
            <p className="certificate-title text-5xl leading-none text-[#9AFF00] sm:text-7xl">SOCIETY</p>
            <div className="neon-rule mt-5 w-full max-w-3xl" />
            <p className="mt-5 max-w-3xl font-[family-name:var(--font-display)] text-lg uppercase tracking-[0.16em] text-zinc-300">
              Olympiad precision. Esports pressure. A private ranking ledger for coders who earn their names.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/leaderboards/yearly">View Rankings <ArrowRight className="size-4" /></Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/contests">Contest Archive <RadioTower className="size-4" /></Link>
              </Button>
            </div>
          </div>
       <div className="relative z-10 flex items-end justify-center p-6 lg:p-10">
        <div className="relative w-full max-w-lg overflow-hidden border border-[#9AFF00]/35 bg-black shadow-[0_0_70px_rgba(142,43,255,.35)]">
          <Image
            src="/deadcoders/invite.png"
            alt="The Dead Coders Society official invite"
            width={900}
            height={1400}
            priority
            className="h-auto w-full object-contain"
          />
        </div>
      </div>
        </section>

        <section className="section-band mt-5 grid gap-5 p-5 lg:grid-cols-[.85fr_1.15fr]">
          <div className="relative min-h-96 overflow-hidden border border-[#c0c0c0]/15">
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-10">
              <div className="relative aspect-square w-full max-w-72 rounded-full border border-[#9AFF00]/40 shadow-[0_0_70px_rgba(154,255,0,.28)]">
                <Image src="/deadcoders/logo.png" alt="The Dead Coders Society logo" fill className="rounded-full object-cover" />
              </div>
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.86),transparent_55%)]" />
          </div>
          <div className="p-1">
            <p className="engraved text-xs">Latest Contest</p>
            {latestContest ? (
              <>
                <div className="mt-3"><StatusBadge status={latestContest.status} /></div>
                <h2 className="certificate-title mt-4 text-4xl text-white sm:text-6xl">{latestContest.title}</h2>
                <p className="mt-4 max-w-3xl text-lg text-zinc-300">{latestContest.description || "Official contest brief will be published by the control room."}</p>
                <div className="mt-6"><Countdown target={latestContest.startTime} /></div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <Stat icon={<Users className="size-5" />} label="Entrants" value={latestContest.entries.length || "Open"} />
                  <Stat icon={<Trophy className="size-5" />} label="Points" value={latestContest.totalPoints} />
                  <Stat icon={<CalendarDays className="size-5" />} label="Status" value={latestContest.status} />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild><Link href={`/contests/${latestContest.slug}`}>Open Contest</Link></Button>
                  <Button asChild variant="ghost"><Link href="/leaderboards/monthly">Monthly Board</Link></Button>
                </div>
              </>
            ) : <EmptyState title="No contest scheduled" copy="The control room can publish the first official championship round." />}
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <LifecycleContest title="Upcoming Contest" contest={upcomingContest} empty="No upcoming contest scheduled." />
          <LifecycleContest title="Live Contest" contest={liveContest} empty="No contest is live right now." />
          <LifecycleContest title="Latest Completed Contest" contest={completedContest} empty="No completed contest yet." />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <div className="section-band p-5">
            <h2 className="certificate-title text-3xl text-[#9AFF00]">Previous Contest Top 5</h2>
            <div className="mt-5 grid gap-3">
              {previousContest?.entries.slice(0, 5).map((entry) => (
                <Link href={`/players/${entry.username}`} key={entry.username} className="ledger-row">
                  <span className="font-[family-name:var(--font-display)] text-[#F3C55B]">#{entry.rank}</span>
                  <span className="font-semibold text-white">{entry.fullName}</span>
                  <span className="text-zinc-500">@{entry.username}</span>
                  <span className="ml-auto font-[family-name:var(--font-display)] text-[#9AFF00]">{entry.finalScore}</span>
                </Link>
              )) ?? <EmptyState title="Awaiting completed standings" copy="Top finalists appear once a contest is closed." />}
            </div>
          </div>
          <div className="section-band p-5">
            <h2 className="certificate-title text-3xl text-[#9AFF00]">Hall of Fame</h2>
            <div className="mt-5"><HallOfFameShowcase rows={year.rows} /></div>
          </div>
        </section>

        <section className="mt-5">
          {month.rows.length ? <LeaderboardTable type="aggregate" rows={month.rows} /> : <EmptyState title="No current rankings" copy="Upload standings to forge this month's official table." />}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="Recent Champions" icon={<Crown className="size-6" />}>
            {winners.length ? winners.map(({ contest, winner }) => (
              <Link href={`/players/${winner.username}`} key={contest.id} className="ledger-row">
                <span>{winner.fullName}</span><span className="ml-auto text-[#9AFF00]">{winner.finalScore}</span>
              </Link>
            )) : <p className="text-sm text-zinc-500">No champions crowned yet.</p>}
          </Panel>
          <Panel title="Upcoming Contests" icon={<CalendarDays className="size-6" />}>
            {upcoming.length ? upcoming.map((contest) => (
              <Link href={`/contests/${contest.slug}`} key={contest.id} className="ledger-row">
                <span>{contest.title}</span><span className="ml-auto text-zinc-500">{formatDateUTC(contest.startTime)}</span>
              </Link>
            )) : <p className="text-sm text-zinc-500">No upcoming contests published.</p>}
          </Panel>
          <Panel title="Society Achievements" icon={<ShieldCheck className="size-6" />}>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Players" value={year.rows.length} />
              <Stat label="Solves" value={totalSolves} />
              <Stat label="Contests" value={contests.length} />
            </div>
          </Panel>
        </section>

        <section className="join-cta mt-5 p-8 text-center">
          <h2 className="certificate-title text-4xl text-white">Join The Society</h2>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-300">Compete, place, solve first, and earn a permanent line in the championship archive.</p>
          <Button asChild className="mt-6"><Link href="/contests">Enter The Archive</Link></Button>
        </section>
      </main>
    </>
  );
}

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="clip-arena border border-[#c0c0c0]/15 bg-black/45 p-4">
      <div className="text-[#9AFF00]">{icon}</div>
      <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="font-[family-name:var(--font-display)] text-xl text-white">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="section-band p-5">
      <div className="flex items-center gap-3 text-[#9AFF00]">{icon}<h2 className="font-[family-name:var(--font-display)] uppercase tracking-[0.16em] text-white">{title}</h2></div>
      <div className="mt-5 grid gap-3">{children}</div>
    </section>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-plaque clip-arena p-6 text-center">
      <p className="certificate-title text-2xl text-[#9AFF00]">{title}</p>
      <p className="mt-2 text-sm text-zinc-400">{copy}</p>
    </div>
  );
}

function LifecycleContest({ title, contest, empty }: { title: string; contest: Awaited<ReturnType<typeof listContests>>[number] | undefined; empty: string }) {
  return (
    <section className="section-band p-5">
      <h2 className="font-[family-name:var(--font-display)] uppercase tracking-[0.16em] text-white">{title}</h2>
      {contest ? (
        <div className="mt-4 grid gap-3">
          <StatusBadge status={contest.status} />
          <Link href={`/contests/${contest.slug}`} className="font-[family-name:var(--font-display)] text-xl uppercase text-[#9AFF00]">{contest.title}</Link>
          <p className="text-sm text-zinc-500">{formatDateUTC(contest.startTime)}</p>
        </div>
      ) : <p className="mt-4 text-sm text-zinc-500">{empty}</p>}
    </section>
  );
}
