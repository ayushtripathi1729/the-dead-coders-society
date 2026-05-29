import { NextResponse } from "next/server";
import { listContests } from "@/lib/leaderboards";

export async function GET() {
  return NextResponse.json({ contests: await listContests() });
}
