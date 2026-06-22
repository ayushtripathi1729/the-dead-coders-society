import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, GraduationCap, Target } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { Nav } from "@/components/nav";
import { getAcademyTopics } from "@/lib/ecosystem";

export const revalidate = 300;

export default async function AcademyPage() {
  const topics = await getAcademyTopics();
  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6">
        <section className="certificate-frame ornate-corners p-6">
          <span className="corner corner-tl" /><span className="corner corner-tr" /><span className="corner corner-bl" /><span className="corner corner-br" />
          <p className="engraved text-xs">TDS Academy</p>
          <h1 className="certificate-title mt-2 text-5xl text-white sm:text-7xl">Academy</h1>
          <p className="mt-3 max-w-2xl font-[family-name:var(--font-mono)] text-zinc-400">Topic ladders, resources, and practice paths built from the same contest history that powers ratings.</p>
        </section>
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/academy/${topic.slug}`} className="section-band group p-5 transition hover:border-[#9AFF00]/60">
              <GraduationCap className="size-6 text-[#9AFF00]" />
              <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl uppercase text-white group-hover:text-[#9AFF00]">{topic.title}</h2>
              <p className="mt-3 min-h-16 text-sm leading-6 text-zinc-400">{topic.overview}</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <Metric icon={<BookOpen className="size-4" />} label="Resources" value={topic.resources.length} />
                <Metric icon={<Target className="size-4" />} label="Problems" value={topic.problems.length} />
                <Metric label="Paths" value={topic._count.recommendations} />
              </div>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}

function Metric({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="clip-arena border border-[#c0c0c0]/15 bg-black/45 p-3">
      <div className="text-[#9AFF00]">{icon}</div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="font-[family-name:var(--font-display)] text-lg text-white">{value}</p>
    </div>
  );
}
