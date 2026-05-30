import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromCloudinary, uploadToCloudinary, type CloudinaryUploadFolder } from "@/server/uploads/cloudinary";

const uploadSchema = z.object({
  kind: z.enum(["POSTER", "INVITE_POSTER", "BANNER", "CERTIFICATE", "PROFILE_IMAGE", "LOGO", "EDITORIAL"]),
  contestId: z.string().optional(),
  playerUsername: z.string().optional(),
});

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function folderForKind(kind: z.infer<typeof uploadSchema>["kind"]): CloudinaryUploadFolder {
  if (kind === "BANNER") return "contests/banners";
  if (kind === "POSTER" || kind === "INVITE_POSTER") return "contests/posters";
  if (kind === "CERTIFICATE") return "certificates";
  return "misc";
}

function friendlyUploadError(error: unknown) {
  if (error instanceof z.ZodError) return "Invalid upload request. Refresh the page and try again.";
  if (error instanceof Error) {
    if (error.message.includes("Cloudinary is not configured")) return error.message;
    if (/cloudinary|upload|invalid image|file/i.test(error.message)) return "Cloudinary could not process this upload. Check the file and try again.";
    return error.message;
  }
  return "Upload failed. Please try again.";
}

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
      playerUsername: formData.get("playerUsername") || undefined,
    });

    const allowsPdf = parsed.kind === "CERTIFICATE";
    if (!allowedImageTypes.has(file.type) && !(allowsPdf && file.type === "application/pdf")) {
      return NextResponse.json({ error: allowsPdf ? "Only JPG, PNG, WEBP, and PDF uploads are allowed." : "Only JPG, PNG, and WEBP uploads are allowed." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Upload must be 8MB or smaller." }, { status: 400 });
    }

    const uploaded = await uploadToCloudinary(file, folderForKind(parsed.kind));
    let record;
    let replacedPublicIds: string[] = [];
    if (parsed.contestId && (parsed.kind === "INVITE_POSTER" || parsed.kind === "BANNER")) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const contest = await tx.contest.findUniqueOrThrow({
            where: { id: parsed.contestId },
            select: { invitePoster: true, bannerPoster: true },
          });
          const previousUrl = parsed.kind === "INVITE_POSTER" ? contest.invitePoster : contest.bannerPoster;
          await tx.contest.update({
            where: { id: parsed.contestId },
            data: parsed.kind === "INVITE_POSTER" ? { invitePoster: uploaded.url } : { bannerPoster: uploaded.url },
          });
          const uploadRecord = await tx.uploadAsset.create({
            data: {
              kind: parsed.kind,
              url: uploaded.url,
              publicId: uploaded.publicId,
              contestId: parsed.contestId,
              playerUsername: parsed.playerUsername,
            },
          });
          const replaced = previousUrl
            ? await tx.uploadAsset.findMany({
                where: { contestId: parsed.contestId, kind: parsed.kind, url: previousUrl },
                select: { id: true, publicId: true },
              })
            : [];
          if (replaced.length) {
            await tx.uploadAsset.deleteMany({ where: { id: { in: replaced.map((asset) => asset.id) } } });
          }
          await tx.activityLog.create({
            data: {
              adminId: admin.id,
              action: "upload.created",
              entity: "UploadAsset",
              entityId: uploadRecord.id,
              metadata: { kind: parsed.kind, contestId: parsed.contestId ?? null, playerUsername: parsed.playerUsername ?? null },
            },
          });
          return { uploadRecord, replacedPublicIds: replaced.map((asset) => asset.publicId).filter(Boolean) as string[] };
        });
        record = result.uploadRecord;
        replacedPublicIds = result.replacedPublicIds;
      } catch (error) {
        await deleteFromCloudinary(uploaded.publicId).catch(() => undefined);
        throw error;
      }
    } else {
      try {
        record = await prisma.uploadAsset.create({
          data: {
            kind: parsed.kind,
            url: uploaded.url,
            publicId: uploaded.publicId,
            contestId: parsed.contestId,
            playerUsername: parsed.playerUsername,
          },
        });
        await prisma.activityLog.create({
          data: {
            adminId: admin.id,
            action: "upload.created",
            entity: "UploadAsset",
            entityId: record.id,
            metadata: { kind: parsed.kind, contestId: parsed.contestId ?? null, playerUsername: parsed.playerUsername ?? null },
          },
        });
      } catch (error) {
        await deleteFromCloudinary(uploaded.publicId).catch(() => undefined);
        throw error;
      }
    }

    await Promise.all(replacedPublicIds.map((publicId) => deleteFromCloudinary(publicId).catch(() => undefined)));

    return NextResponse.json({ ok: true, upload: record, url: uploaded.url });
  } catch (error) {
    return NextResponse.json({ error: friendlyUploadError(error) }, { status: 400 });
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

    const publicIds = await prisma.$transaction(async (tx) => {
      const contest = await tx.contest.findUniqueOrThrow({
        where: { id: parsed.contestId },
        select: { invitePoster: true, bannerPoster: true },
      });
      const previousUrl = parsed.kind === "INVITE_POSTER" ? contest.invitePoster : contest.bannerPoster;
      const assets = previousUrl
        ? await tx.uploadAsset.findMany({
            where: { contestId: parsed.contestId, kind: parsed.kind, url: previousUrl },
            select: { id: true, publicId: true },
          })
        : [];
      await tx.contest.update({
        where: { id: parsed.contestId },
        data: parsed.kind === "INVITE_POSTER" ? { invitePoster: null } : { bannerPoster: null },
      });
      if (assets.length) {
        await tx.uploadAsset.deleteMany({ where: { id: { in: assets.map((asset) => asset.id) } } });
      }
      await tx.activityLog.create({
        data: {
          adminId: admin.id,
          action: "upload.removed",
          entity: "Contest",
          entityId: parsed.contestId,
          metadata: { kind: parsed.kind },
        },
      });
      return assets.map((asset) => asset.publicId).filter(Boolean) as string[];
    });
    await Promise.all(publicIds.map((publicId) => deleteFromCloudinary(publicId).catch(() => undefined)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove upload." }, { status: 400 });
  }
}
