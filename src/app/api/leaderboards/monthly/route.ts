import { NextRequest, NextResponse } from "next/server";
import { monthlyLeaderboard } from "@/lib/leaderboards";

export async function GET(request: NextRequest) {
  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get("year") ?? now.getUTCFullYear());
  const month = Number(request.nextUrl.searchParams.get("month") ?? now.getUTCMonth() + 1);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month." }, { status: 400 });
  }
  return NextResponse.json(await monthlyLeaderboard(year, month));
}
