import { NextRequest, NextResponse } from "next/server";
import { rebuildRatings } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await rebuildRatings(admin.id);
    return NextResponse.json({ ok: true, message: "Ratings rebuilt successfully." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rebuild failed" },
      { status: 400 }
    );
  }
}
