import { NextRequest, NextResponse } from "next/server";
import { recalculateContest } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { readBody } from "@/lib/request";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contestId } = await readBody(request);
  if (!contestId) return NextResponse.json({ error: "contestId required" }, { status: 400 });

  try {
    await recalculateContest(contestId, admin.id);
    return NextResponse.json({ ok: true, message: "Contest recalculated successfully." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recalculation failed" },
      { status: 400 }
    );
  }
}
