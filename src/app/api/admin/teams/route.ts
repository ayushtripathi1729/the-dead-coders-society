import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { refreshAllDerived, slugify } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/request";

const teamSchema = z.object({
  name: z.string().trim().min(2).max(120),
  institutionId: z.string().trim().min(1).optional().or(z.literal("")).nullable(),
  captainUsername: z.string().trim().min(1).max(48).optional().or(z.literal("")).nullable(),
});

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const teams = await prisma.team.findMany({
    orderBy: [{ points: "desc" }, { name: "asc" }],
    include: { memberships: true, achievements: true, institution: true },
  });
  return NextResponse.json({ teams });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = teamSchema.parse(await readBody(request));
    const slug = slugify(input.name);
    if (!slug) throw new Error("Team name must contain at least one letter or number.");
    const captainUsername = input.captainUsername?.toLowerCase() || null;
    const team = await prisma.$transaction(async (tx) => {
      if (captainUsername) await tx.player.findUniqueOrThrow({ where: { username: captainUsername }, select: { username: true } });
      const saved = await tx.team.create({
        data: {
          name: input.name,
          slug,
          institutionId: input.institutionId || null,
          memberships: captainUsername ? { create: { playerUsername: captainUsername, role: "CAPTAIN" } } : undefined,
        },
      });
      await tx.activityLog.create({ data: { adminId: admin.id, action: "team.created", entity: "Team", entityId: saved.id } });
      return saved;
    });
    await refreshAllDerived();
    revalidateTag("ecosystem");
    revalidatePath("/teams");
    return NextResponse.json({ ok: true, team });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create team." }, { status: 400 });
  }
}
