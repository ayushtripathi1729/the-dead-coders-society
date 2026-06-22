import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { prisma } from "@/lib/prisma";

const discussionSchema = z.object({
  title: z.string().trim().min(4).max(140),
  author: z.string().trim().min(2).max(80),
  body: z.string().trim().min(4).max(2000),
  scope: z.enum(["GENERAL", "CONTEST", "PROBLEM"]).default("GENERAL"),
  contestId: z.string().trim().min(1).optional().or(z.literal("")).nullable(),
  problemCode: z.string().trim().max(16).optional().or(z.literal("")).nullable(),
});

export async function POST(request: NextRequest) {
  if (!enforceSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (!rateLimit(request, 8, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }
  try {
    const input = discussionSchema.parse(await request.json());
    const contestId = input.contestId || null;
    if (contestId) {
      await prisma.contest.findUniqueOrThrow({ where: { id: contestId }, select: { id: true } });
    }
    const thread = await prisma.discussionThread.create({
      data: {
        title: input.title,
        scope: input.scope,
        contestId,
        problemCode: input.problemCode || null,
        status: "PENDING",
        posts: {
          create: {
            author: input.author,
            body: input.body,
            status: "PENDING",
          },
        },
      },
      select: { id: true },
    });
    return NextResponse.json({ thread, status: "PENDING" }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit discussion." }, { status: 400 });
  }
}
