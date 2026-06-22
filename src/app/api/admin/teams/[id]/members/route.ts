import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { refreshAllDerived } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/request";

const memberSchema = z.object({
  username: z.string().trim().min(1).max(48),
  role: z.enum(["CAPTAIN", "MEMBER"]).default("MEMBER"),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const input = memberSchema.parse(await readBody(request));
    const username = input.username.toLowerCase();
    await prisma.$transaction(async (tx) => {
      await tx.team.findUniqueOrThrow({ where: { id }, select: { id: true } });
      await tx.player.findUniqueOrThrow({ where: { username }, select: { username: true } });
      if (input.role === "CAPTAIN") {
        await tx.teamMembership.updateMany({ where: { teamId: id, role: "CAPTAIN" }, data: { role: "MEMBER" } });
      }
      await tx.teamMembership.upsert({
        where: { teamId_playerUsername: { teamId: id, playerUsername: username } },
        update: { role: input.role },
        create: { teamId: id, playerUsername: username, role: input.role },
      });
      await tx.activityLog.create({ data: { adminId: admin.id, action: "team.member.saved", entity: "Team", entityId: id, metadata: { username, role: input.role } } });
    });
    await refreshAllDerived();
    revalidateTag("ecosystem");
    revalidatePath("/teams");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save team member." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const input = memberSchema.pick({ username: true }).parse(await readBody(request));
    const username = input.username.toLowerCase();
    await prisma.$transaction(async (tx) => {
      await tx.teamMembership.deleteMany({ where: { teamId: id, playerUsername: username } });
      await tx.activityLog.create({ data: { adminId: admin.id, action: "team.member.removed", entity: "Team", entityId: id, metadata: { username } } });
    });
    await refreshAllDerived();
    revalidateTag("ecosystem");
    revalidatePath("/teams");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove team member." }, { status: 400 });
  }
}
