import { NextRequest, NextResponse } from "next/server";
import { yearlyLeaderboard } from "@/lib/leaderboards";

export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get("year") ?? new Date().getUTCFullYear());
  return NextResponse.json(await yearlyLeaderboard(year));
}
