import { NextRequest, NextResponse } from "next/server";
import { upsertContestEntries } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { fetchCodeforcesStandings } from "@/lib/codeforces";
import { readBody } from "@/lib/request";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readBody(request);
  const standingsUrl = String(body.standingsUrl ?? "");
  const contestId = String(body.contestId ?? "");

  try {
    const entries = await fetchCodeforcesStandings(standingsUrl);
    if (contestId) {
      await upsertContestEntries(contestId, entries, admin.id);
    }
    return NextResponse.json({
      ok: true,
      imported: entries.length,
      entries,
      note: contestId ? "Standings saved and rankings will update automatically." : "Preview only. Send contestId to persist.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sync standings." }, { status: 400 });
  }
}
