import Link from "next/link";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { ArenaBackground } from "@/components/arena-background";
import { Nav } from "@/components/nav";
import { getDiscussionThreads } from "@/lib/ecosystem";
import { formatDateUTC } from "@/lib/utils";

export const revalidate = 60;

export default async function DiscussionsPage() {
  const threads = await getDiscussionThreads();
  return (
    <>
      <ArenaBackground />
      <Nav />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-28 sm:px-6">
        <section className="certificate-frame ornate-corners p-6">
          <span className="corner corner-tl" /><span className="corner corner-tr" /><span className="corner corner-bl" /><span className="corner corner-br" />
          <p className="engraved text-xs">Moderated Forum</p>
          <h1 className="certificate-title mt-2 text-5xl text-white sm:text-7xl">Discussions</h1>
          <p className="mt-3 max-w-2xl font-[family-name:var(--font-mono)] text-zinc-400">Contest, problem, and general discussion threads. Public posts enter moderation before publication.</p>
        </section>
        <section className="mt-6 grid gap-4">
          {threads.map((thread) => (
            <article key={thread.id} className="section-band p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#9AFF00]">{thread.scope}{thread.problemCode ? ` / ${thread.problemCode}` : ""}</p>
                  <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl uppercase text-white">{thread.title}</h2>
                  {thread.contest && <Link href={`/contests/${thread.contest.slug}`} className="mt-1 inline-block text-sm text-zinc-400 hover:text-[#9AFF00]">{thread.contest.title}</Link>}
                </div>
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500"><ShieldCheck className="size-4 text-[#9AFF00]" /> Approved</div>
              </div>
              <div className="mt-5 grid gap-3">
                {thread.posts.map((post) => (
                  <div key={post.id} className="clip-arena border border-white/10 bg-black/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-[family-name:var(--font-display)] text-sm uppercase text-[#F3C55B]">{post.author}</p>
                      <p className="text-xs text-zinc-500">{formatDateUTC(post.createdAt)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">{post.body}</p>
                  </div>
                ))}
                {!thread.posts.length && <p className="text-sm text-zinc-500">No approved posts yet.</p>}
              </div>
            </article>
          ))}
        </section>
        {!threads.length && <section className="empty-plaque clip-arena mt-6 p-8 text-center"><MessageSquare className="mx-auto size-8 text-[#9AFF00]" /><p className="mt-3 certificate-title text-3xl text-[#9AFF00]">No approved discussions</p><p className="mt-2 text-zinc-400">The moderation queue is ready for future threads.</p></section>}
      </main>
    </>
  );
}
