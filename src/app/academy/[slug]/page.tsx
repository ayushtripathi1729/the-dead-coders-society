import { notFound } from "next/navigation";
import { BookOpen, Target } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { Nav } from "@/components/nav";
import { getAcademyTopic } from "@/lib/ecosystem";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

export async function generateStaticParams() {
  const topics = await prisma.academyTopic.findMany({ select: { slug: true } });
  return topics.map((topic) => ({ slug: topic.slug }));
}

export default async function AcademyTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await getAcademyTopic(slug);
  if (!topic) notFound();
  const groups = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-28 sm:px-6">
        <section className="section-band p-6 md:p-8">
          <p className="engraved text-xs">Academy Topic</p>
          <h1 className="certificate-title mt-2 text-5xl text-white sm:text-7xl">{topic.title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-7 text-zinc-300">{topic.overview}</p>
        </section>
        <section className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div className="section-band p-5">
            <div className="flex items-center gap-3 text-[#9AFF00]"><BookOpen className="size-5" /><h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase text-white">Resources</h2></div>
            <div className="mt-5 grid gap-3">
              {topic.resources.length ? topic.resources.map((resource) => (
                <a key={resource.id} href={resource.url} className="ledger-row">
                  <span>{resource.title}</span>
                  <span className="ml-auto text-[#9AFF00]">{resource.kind}</span>
                </a>
              )) : <p className="text-sm text-zinc-500">Resources can be managed from the Control Room.</p>}
            </div>
          </div>
          <div className="section-band p-5">
            <div className="flex items-center gap-3 text-[#9AFF00]"><Target className="size-5" /><h2 className="section-rune font-[family-name:var(--font-display)] text-xl uppercase text-white">Difficulty Ladder</h2></div>
            <div className="mt-5 grid gap-5">
              {groups.map((difficulty) => {
                const problems = topic.problems.filter((problem) => problem.difficulty === difficulty);
                return (
                  <div key={difficulty}>
                    <p className="font-[family-name:var(--font-display)] text-sm uppercase tracking-[0.18em] text-[#F3C55B]">{difficulty}</p>
                    <div className="mt-3 grid gap-2">
                      {problems.length ? problems.map((problem) => (
                        problem.url ? <a key={problem.id} href={problem.url} className="ledger-row"><span>{problem.title}</span><span className="ml-auto text-[#9AFF00]">{problem.rating}</span></a>
                          : <div key={problem.id} className="ledger-row"><span>{problem.title}</span><span className="ml-auto text-[#9AFF00]">{problem.rating}</span></div>
                      )) : <p className="text-sm text-zinc-500">No {difficulty.toLowerCase()} problems yet.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
