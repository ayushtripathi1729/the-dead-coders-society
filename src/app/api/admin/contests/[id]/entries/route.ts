import { NextRequest, NextResponse } from "next/server";
import { deleteContestEntry, finalizeContestStandings, parseStandingsText, recalculateContest, saveContestProblemDraft, updateContestEntry, upsertContestEntries } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { readBody } from "@/lib/request";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await readBody(request);
  try {
    const entries = Array.isArray(body.entries)
      ? body.entries
      : parseStandingsText(String(body.standingsText ?? ""));
    const saved = await upsertContestEntries(id, entries, admin.id);
    return NextResponse.json({ ok: true, saved: saved.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save standings." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await readBody(request);
  try {
    if (body.action === "recalculate") {
      await recalculateContest(id, admin.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "finalize") {
      const result = await finalizeContestStandings(id, Array.isArray(body.problems) ? body.problems : [], admin.id);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "saveProblems") {
      await saveContestProblemDraft(id, Array.isArray(body.problems) ? body.problems : [], admin.id);
      return NextResponse.json({ ok: true });
    }
    if (!body.standingId) throw new Error("standingId is required.");
    await updateContestEntry(id, String(body.standingId), body, admin.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update standing." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await readBody(request);
  try {
    if (!body.standingId) throw new Error("standingId is required.");
    await deleteContestEntry(id, String(body.standingId), admin.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete standing." }, { status: 400 });
  }
}
