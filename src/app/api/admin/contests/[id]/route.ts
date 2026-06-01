import { NextRequest, NextResponse } from "next/server";
import { checkAndFinalizeContest, createOrUpdateContest, deleteContest } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { readBody } from "@/lib/request";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await readBody(request);
  try {
    const contest = await createOrUpdateContest(body, id, admin.id);
    // Auto-finalize if contest is completed
    await checkAndFinalizeContest(id, admin.id).catch(() => undefined);
    return NextResponse.json({ ok: true, contest });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update contest." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteContest(id, admin.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete contest." }, { status: 400 });
  }
}
