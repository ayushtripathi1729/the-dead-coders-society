import { NextRequest, NextResponse } from "next/server";
import { updateContestVisibility } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { readBody } from "@/lib/request";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { visibility } = await readBody(request);

  if (!["PUBLIC", "PRIVATE", "ARCHIVED"].includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility value" }, { status: 400 });
  }

  try {
    const contest = await updateContestVisibility(id, visibility, admin.id);
    return NextResponse.json({ ok: true, contest });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update contest visibility." }, { status: 400 });
  }
}
