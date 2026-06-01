import { NextRequest, NextResponse } from "next/server";
import { rebuildEverything, rebuildHallOfFameOnly, rebuildLeaderboards, rebuildRatings, recalculateContest } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { readBody } from "@/lib/request";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readBody(request);
  const action = String(body.action ?? "");

  try {
    if (action === "recalculateContest") {
      const contestId = String(body.contestId ?? "");
      if (!contestId) throw new Error("contestId is required.");
      await recalculateContest(contestId, admin.id);
    } else if (action === "rebuildRatings") {
      await rebuildRatings(admin.id);
    } else if (action === "rebuildLeaderboards") {
      await rebuildLeaderboards(admin.id);
    } else if (action === "rebuildHallOfFame") {
      await rebuildHallOfFameOnly(admin.id);
    } else if (action === "rebuildEverything") {
      await rebuildEverything(admin.id);
    } else {
      throw new Error("Unknown recovery action.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Recovery action failed." }, { status: 400 });
  }
}
