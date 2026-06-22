import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/request";

const resourceSchema = z.object({
  title: z.string().trim().min(1).max(120),
  url: z.string().url().refine((value) => /^https?:\/\//i.test(value), "Only HTTP(S) URLs are allowed."),
});

const editorialSchema = z.object({
  content: z.string().trim().max(20_000).default(""),
  resources: z.array(resourceSchema).max(20).default([]),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const input = editorialSchema.parse(await readBody(request));
    const contest = await prisma.contest.findUniqueOrThrow({ where: { id }, select: { id: true, slug: true } });
    const editorial = await prisma.$transaction(async (tx) => {
      const saved = await tx.contestEditorial.upsert({
        where: { contestId: contest.id },
        update: { content: input.content, resources: input.resources },
        create: { contestId: contest.id, content: input.content, resources: input.resources },
      });
      const latest = await tx.editorialRevision.aggregate({ where: { editorialId: saved.id }, _max: { version: true } });
      await tx.editorialRevision.create({
        data: { editorialId: saved.id, content: input.content, version: (latest._max.version ?? 0) + 1 },
      });
      await tx.activityLog.create({
        data: { adminId: admin.id, action: "editorial.updated", entity: "ContestEditorial", entityId: contest.id },
      });
      return saved;
    });
    revalidateTag("public-contests");
    revalidateTag("ecosystem");
    revalidatePath(`/contests/${contest.slug}`);
    return NextResponse.json({ ok: true, editorial });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save editorial." }, { status: 400 });
  }
}
