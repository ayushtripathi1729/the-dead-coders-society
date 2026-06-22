import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/request";

const progressSchema = z.object({
  playerUsername: z.string().trim().min(1).max(48),
  topicId: z.string().trim().min(1).max(80),
  completed: z.coerce.number().int().min(0).max(10_000),
  total: z.coerce.number().int().min(0).max(10_000),
});

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = progressSchema.parse(await readBody(request));
    if (input.completed > input.total && input.total > 0) throw new Error("Completed count cannot exceed total.");
    const playerUsername = input.playerUsername.toLowerCase();
    const progress = await prisma.$transaction(async (tx) => {
      await tx.player.findUniqueOrThrow({ where: { username: playerUsername }, select: { username: true } });
      await tx.academyTopic.findUniqueOrThrow({ where: { id: input.topicId }, select: { id: true } });
      const saved = await tx.academyProgress.upsert({
        where: { playerUsername_topicId: { playerUsername, topicId: input.topicId } },
        update: { completed: input.completed, total: input.total, lastPracticedAt: new Date() },
        create: { playerUsername, topicId: input.topicId, completed: input.completed, total: input.total, lastPracticedAt: new Date() },
      });
      await tx.activityLog.create({
        data: { adminId: admin.id, action: "academy.progress.saved", entity: "AcademyProgress", entityId: saved.id, metadata: { playerUsername, topicId: input.topicId } },
      });
      return saved;
    });
    revalidateTag("ecosystem");
    revalidateTag("public-players");
    revalidatePath("/academy");
    revalidatePath(`/players/${playerUsername}`);
    return NextResponse.json({ ok: true, progress });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save academy progress." }, { status: 400 });
  }
}
