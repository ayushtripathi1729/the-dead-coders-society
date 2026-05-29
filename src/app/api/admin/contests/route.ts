import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateContest } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { listContests } from "@/lib/leaderboards";
import { readBody } from "@/lib/request";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ contests: await listContests({ includeHidden: true }) });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readBody(request);
  try {
    const contest = await createOrUpdateContest(body, undefined, admin.id);
    return NextResponse.json({ ok: true, contest });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create contest." }, { status: 400 });
  }
}
