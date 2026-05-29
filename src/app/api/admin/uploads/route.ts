import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToCloudinary } from "@/server/uploads/cloudinary";

const uploadSchema = z.object({
  kind: z.enum(["POSTER", "INVITE_POSTER", "BANNER", "CERTIFICATE", "PROFILE_IMAGE", "LOGO", "EDITORIAL"]),
  contestId: z.string().optional(),
  playerId: z.string().optional(),
});

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Upload file is required." }, { status: 400 });
    const parsed = uploadSchema.parse({
      kind: formData.get("kind"),
      contestId: formData.get("contestId") || undefined,
      playerId: formData.get("playerId") || undefined,
    });

    const allowsPdf = parsed.kind === "CERTIFICATE";
    if (!allowedImageTypes.has(file.type) && !(allowsPdf && file.type === "application/pdf")) {
      return NextResponse.json({ error: allowsPdf ? "Only JPG, PNG, WEBP, and PDF uploads are allowed." : "Only JPG, PNG, and WEBP uploads are allowed." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Upload must be 8MB or smaller." }, { status: 400 });
    }

    const uploaded = await uploadToCloudinary(file);
    if (parsed.contestId && (parsed.kind === "INVITE_POSTER" || parsed.kind === "BANNER")) {
      await prisma.contest.update({
        where: { id: parsed.contestId },
        data: parsed.kind === "INVITE_POSTER" ? { invitePoster: uploaded.url } : { bannerPoster: uploaded.url },
      });
    }

    const record = await prisma.uploadAsset.create({
      data: {
        kind: parsed.kind,
        url: uploaded.url,
        publicId: uploaded.publicId,
        contestId: parsed.contestId,
        playerId: parsed.playerId,
      },
    });
    await prisma.activityLog.create({
      data: {
        adminId: admin.id,
        action: "upload.created",
        entity: "UploadAsset",
        entityId: record.id,
        metadata: { kind: parsed.kind, contestId: parsed.contestId ?? null, playerId: parsed.playerId ?? null },
      },
    });

    return NextResponse.json({ ok: true, upload: record, url: uploaded.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = z.object({
      action: z.literal("remove"),
      kind: z.enum(["INVITE_POSTER", "BANNER"]),
      contestId: z.string().min(1),
    }).parse(body);

    await prisma.contest.update({
      where: { id: parsed.contestId },
      data: parsed.kind === "INVITE_POSTER" ? { invitePoster: null } : { bannerPoster: null },
    });
    await prisma.activityLog.create({
      data: {
        adminId: admin.id,
        action: "upload.removed",
        entity: "Contest",
        entityId: parsed.contestId,
        metadata: { kind: parsed.kind },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove upload." }, { status: 400 });
  }
}
