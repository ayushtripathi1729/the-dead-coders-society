import { ContestCarousel } from "@/components/contest-carousel";
import { ArenaBackground } from "@/components/arena-background";
import { Nav } from "@/components/nav";
import type { ContestView } from "@/lib/types";

export function ContestStatusPage({ eyebrow, title, description, contests }: { eyebrow: string; title: string; description: string; contests: ContestView[] }) {
  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-24 sm:px-6">
        <section className="certificate-frame ornate-corners p-6">
          <span className="corner corner-tl" /><span className="corner corner-tr" /><span className="corner corner-bl" /><span className="corner corner-br" />
          <p className="engraved text-xs">{eyebrow}</p>
          <h1 className="certificate-title mt-2 text-6xl">{title}</h1>
          <p className="mt-3 max-w-2xl font-[family-name:var(--font-mono)] text-zinc-400">{description}</p>
        </section>
        <section className="mt-5">
          {contests.length ? <ContestCarousel contests={contests} /> : (
            <div className="empty-plaque clip-arena p-6 text-center">
              <p className="certificate-title text-2xl text-[#9AFF00]">No contests here</p>
              <p className="mt-2 text-zinc-400">This list updates automatically from contest start time and duration.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
