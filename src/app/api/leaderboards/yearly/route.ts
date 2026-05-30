import { NextRequest, NextResponse } from "next/server";
import { yearlyLeaderboard } from "@/lib/leaderboards";

export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get("year") ?? new Date().getUTCFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }
  return NextResponse.json(await yearlyLeaderboard(year));
}
