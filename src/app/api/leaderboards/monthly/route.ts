import { NextRequest, NextResponse } from "next/server";
import { monthlyLeaderboard } from "@/lib/leaderboards";

export async function GET(request: NextRequest) {
  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get("year") ?? now.getUTCFullYear());
  const month = Number(request.nextUrl.searchParams.get("month") ?? now.getUTCMonth() + 1);
  return NextResponse.json(await monthlyLeaderboard(year, month));
}
