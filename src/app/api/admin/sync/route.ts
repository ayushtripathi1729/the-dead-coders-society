import { NextRequest, NextResponse } from "next/server";
import { syncCompletedContests } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncCompletedContests(admin.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sync completed contests." }, { status: 400 });
  }
}
