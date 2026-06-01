import { NextRequest, NextResponse } from "next/server";
import { syncCompletedContests } from "@/lib/admin-actions";

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();

    // Verify the request is coming from a trusted source
    if (secret !== process.env.BACKGROUND_JOB_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncCompletedContests(undefined, { force: false });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Background sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
