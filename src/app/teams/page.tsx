import Link from "next/link";
import type { ReactNode } from "react";
import { Crown, Shield, Trophy, Users } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { Nav } from "@/components/nav";
import { getTeams } from "@/lib/ecosystem";

export const revalidate = 120;

export default async function TeamsPage() {
  const teams = await getTeams();
  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6">
        <section className="certificate-frame ornate-corners p-6">
          <span className="corner corner-tl" /><span className="corner corner-tr" /><span className="corner corner-bl" /><span className="corner corner-br" />
          <p className="engraved text-xs">TDS Team League</p>
          <h1 className="certificate-title mt-2 text-5xl text-white sm:text-7xl">Teams</h1>
          <p className="mt-3 max-w-2xl font-[family-name:var(--font-mono)] text-zinc-400">Team standings, captain rosters, achievements, and league ratings.</p>
        </section>
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {teams.map((team) => {
            const captain = team.memberships.find((membership) => membership.role === "CAPTAIN");
            return (
              <article key={team.id} className="section-band p-5">
                <Shield className="size-6 text-[#9AFF00]" />
                <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl uppercase text-white">{team.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{team.institution?.name ?? "Independent team"}</p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <Metric icon={<Trophy className="size-4" />} label="Points" value={team.points} />
                  <Metric icon={<Crown className="size-4" />} label="Wins" value={team.wins} />
                  <Metric icon={<Users className="size-4" />} label="Rating" value={team.rating} />
                </div>
                <div className="mt-5 grid gap-2">
                  <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.18em] text-[#F3C55B]">Members</p>
                  {team.memberships.map((membership) => (
                    <Link key={membership.id} href={`/players/${membership.playerUsername}`} className="ledger-row">
                      <span>{membership.player.fullName}</span>
                      <span className="ml-auto text-[#9AFF00]">{membership.role === "CAPTAIN" ? "Captain" : membership.player.ratingTitle}</span>
                    </Link>
                  ))}
                  {!team.memberships.length && <p className="text-sm text-zinc-500">No members yet.</p>}
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-zinc-500">Captain: {captain ? `@${captain.playerUsername}` : "Unassigned"}</p>
              </article>
            );
          })}
        </section>
        {!teams.length && <section className="empty-plaque clip-arena mt-6 p-8 text-center"><p className="certificate-title text-3xl text-[#9AFF00]">No teams yet</p><p className="mt-2 text-zinc-400">Teams can be created from the Control Room once league play begins.</p></section>}
      </main>
    </>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="clip-arena border border-[#c0c0c0]/15 bg-black/45 p-3">
      <div className="text-[#9AFF00]">{icon}</div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="font-[family-name:var(--font-display)] text-lg text-white">{value}</p>
    </div>
  );
}
