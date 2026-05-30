import { NextRequest, NextResponse } from "next/server";
import { updatePlayerProfile } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { readBody } from "@/lib/request";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { username } = await params;
  const body = await readBody(request);
  try {
    const player = await updatePlayerProfile(decodeURIComponent(username), body, admin.id);
    return NextResponse.json({ ok: true, player });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update player." }, { status: 400 });
  }
}
