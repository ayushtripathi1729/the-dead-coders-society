import { LockKeyhole, ShieldCheck } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { adminSignIn, adminSignOut } from "@/actions/auth-actions";
import { AdminWorkbench } from "@/components/admin-workbench";
import { ArenaBackground } from "@/components/arena-background";
import { listContests } from "@/lib/leaderboards";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type ActivityLogSelect = Prisma.ActivityLogGetPayload<{ select: { id: true; action: true; entity: true; entityId: true; createdAt: true } }>;
type PlayerSelect = Prisma.PlayerGetPayload<{ select: { id: true; fullName: true; username: true; year: true; email: true; branchCourse: true; avatar: true; bio: true; role: true; currentRating: true; peakRating: true; totalSolved: true; wins: true; firstSolves: true; totalScore: true } }>;

export default async function ControlRoomAdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const isAuthed = session?.user?.role === "ADMIN";
  const contests = isAuthed ? await listContests({ includeHidden: true }) : [];
  const activityLogs: ActivityLogSelect[] = isAuthed
    ? await prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, action: true, entity: true, entityId: true, createdAt: true },
      })
    : [];
  const players: PlayerSelect[] = isAuthed
    ? await prisma.player.findMany({
        orderBy: [{ fullName: "asc" }, { username: "asc" }],
        select: { id: true, fullName: true, username: true, year: true, email: true, branchCourse: true, avatar: true, bio: true, role: true, currentRating: true, peakRating: true, totalSolved: true, wins: true, firstSolves: true, totalScore: true },
      })
    : [];

  return (
    <>
      <ArenaBackground />
      <main className="mx-auto w-full max-w-[1800px] px-4 pb-20 pt-12 sm:px-6">
        <div className="section-band mb-5 p-6">
          <p className="engraved text-xs">Private operations route</p>
          <h1 data-text="Control Room" className="glitch certificate-title mt-2 text-5xl text-white sm:text-7xl">Control Room</h1>
          <p className="mt-3 max-w-2xl font-[family-name:var(--font-mono)] text-zinc-400">Protected contest, standings, player, and upload management for The Dead Coders Society.</p>
        </div>
        {!isAuthed ? (
          <section className="section-band mx-auto max-w-xl p-6">
            <LockKeyhole className="size-9 text-[#9AFF00]" />
            <h2 className="section-rune mt-4 font-[family-name:var(--font-display)] text-xl uppercase">Admin Authentication</h2>
            {params.error && <p className="mt-3 text-sm text-red-200">Invalid admin credentials.</p>}
            <form action={adminSignIn} className="mt-5 grid gap-3">
              <input
                suppressHydrationWarning
                autoComplete="off"
                name="email"
                type="email"
                placeholder="ADMIN_EMAIL"
                className="terminal-field clip-arena px-4 py-3 font-[family-name:var(--font-mono)] text-sm"
                required
              />
              <input
                suppressHydrationWarning
                autoComplete="off"
                name="password"
                type="password"
                placeholder="Admin password"
                className="terminal-field clip-arena px-4 py-3 font-[family-name:var(--font-mono)] text-sm"
                required
              />
              <Button type="submit">Enter Control Room</Button>
            </form>
          </section>
        ) : (
          <>
            <form action={adminSignOut} className="mb-5 flex justify-end">
              <Button type="submit" variant="ghost"><ShieldCheck className="size-4" /> Secure Sign Out</Button>
            </form>
            <AdminWorkbench
              contests={contests}
              activityLogs={activityLogs.map((log: ActivityLogSelect) => ({ ...log, createdAt: log.createdAt.toISOString() }))}
              players={players}
            />
          </>
        )}
      </main>
    </>
  );
}
