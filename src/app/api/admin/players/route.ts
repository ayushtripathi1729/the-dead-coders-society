import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const players = await prisma.player.findMany({
    orderBy: [{ fullName: "asc" }, { username: "asc" }],
    select: { id: true, fullName: true, username: true, year: true, email: true, branchCourse: true, avatar: true, bio: true, currentRating: true, peakRating: true, totalSolved: true, wins: true, firstSolves: true, totalScore: true },
  });
  return NextResponse.json({ players });
}
