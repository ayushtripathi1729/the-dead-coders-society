import { ContestCarousel } from "@/components/contest-carousel";
import { ArenaBackground } from "@/components/arena-background";
import { Nav } from "@/components/nav";
import { listContests } from "@/lib/leaderboards";

export const dynamic = "force-dynamic";

export default async function ContestArchivePage() {
  const contests = await listContests();
  const groups = [
    ["Live Contests", contests.filter((contest) => contest.status === "LIVE")],
    ["Upcoming Contests", contests.filter((contest) => contest.status === "UPCOMING")],
    ["Past Contests", contests.filter((contest) => contest.status === "FINISHED")],
  ] as const;

  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-24 sm:px-6">
        <section className="certificate-frame ornate-corners p-6">
          <span className="corner corner-tl" /><span className="corner corner-tr" /><span className="corner corner-bl" /><span className="corner corner-br" />
          <p className="engraved text-xs">Archive</p>
          <h1 className="certificate-title mt-2 text-6xl">Contest Archive</h1>
          <p className="mt-3 max-w-2xl font-[family-name:var(--font-mono)] text-zinc-400">Upcoming arenas, live battles, and completed championship records.</p>
        </section>
        {groups.map(([title, items]) => (
          <section key={title} className="mt-5">
            <h2 className="certificate-title text-3xl text-[#9AFF00]">{title}</h2>
            <div className="mt-4">
              {items.length ? <ContestCarousel contests={items} /> : (
                <div className="empty-plaque clip-arena p-6 text-center md:col-span-2 xl:col-span-3">
                  <p className="certificate-title text-2xl text-[#9AFF00]">Upcoming soon</p>
                  <p className="mt-2 text-zinc-400">No contests in this chamber yet.</p>
                </div>
              )}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
