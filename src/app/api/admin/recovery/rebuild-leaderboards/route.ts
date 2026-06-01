import { NextRequest, NextResponse } from "next/server";
import { rebuildLeaderboards } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await rebuildLeaderboards(admin.id);
    return NextResponse.json({ ok: true, message: "Leaderboards rebuilt successfully." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rebuild failed" },
      { status: 400 }
    );
  }
}
