import { NextRequest, NextResponse } from "next/server";
import { upsertContestEntries } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { fetchCodeforcesStandings } from "@/lib/codeforces";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/request";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await readBody(request);
  const standingsUrl = String(body.standingsUrl ?? "");
  try {
    const entries = await fetchCodeforcesStandings(standingsUrl);
    await upsertContestEntries(id, entries, admin.id, { allowExisting: true });
    await prisma.contest.update({ where: { id }, data: { contestLink: standingsUrl } });
    return NextResponse.json({ ok: true, imported: entries.length });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Codeforces sync failed.",
      fallback: "For private/mashup contests, use manual standings text or row entry instead.",
    }, { status: 400 });
  }
}
