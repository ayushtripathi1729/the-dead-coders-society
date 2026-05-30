import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/request";
import { uploadDataUriToCloudinary } from "@/server/uploads/cloudinary";

const certificateSchema = z.object({
  type: z.enum(["PARTICIPATION", "WINNER", "CONTEST"]),
  title: z.string().min(2).max(140),
  playerUsername: z.string().trim().min(1).max(48).regex(/^[a-zA-Z0-9_.+-]+$/).optional(),
  contestId: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const input = certificateSchema.parse(await readBody(request));
    const [player, contest] = await Promise.all([
      input.playerUsername ? prisma.player.findFirst({ where: { username: { equals: input.playerUsername, mode: "insensitive" } } }) : null,
      input.contestId ? prisma.contest.findUnique({ where: { id: input.contestId } }) : null,
    ]);
    if (input.playerUsername && !player) throw new Error("Player not found.");
    if (input.contestId && !contest) throw new Error("Contest not found.");

    const recipient = player?.fullName ?? "The Dead Coders Society";
    const subtitle = contest?.title ?? "Official Championship Record";
    const svg = renderCertificateSvg(input.title, recipient, subtitle, input.type);
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    const uploaded = await uploadDataUriToCloudinary(dataUri, "dead-coders-society/certificates");

    const certificate = await prisma.certificate.create({
      data: {
        type: input.type,
        title: input.title,
        player: player ? { connect: { username: player.username } } : undefined,
        contest: contest ? { connect: { id: contest.id } } : undefined,
        assetUrl: uploaded.url,
      },
    });

    await prisma.activityLog.create({
      data: {
        admin: { connect: { id: admin.id } },
        action: "certificate.generate",
        entity: "Certificate",
        entityId: certificate.id,
        metadata: { type: input.type, assetUrl: uploaded.url },
      },
    });

    return NextResponse.json({ ok: true, certificate });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Certificate generation failed." }, { status: 400 });
  }
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);
}

function renderCertificateSvg(title: string, recipient: string, subtitle: string, type: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100">
  <rect width="1600" height="1100" fill="#050505"/>
  <rect x="70" y="70" width="1460" height="960" fill="none" stroke="#9aff00" stroke-width="4"/>
  <rect x="105" y="105" width="1390" height="890" fill="none" stroke="#8e2bff" stroke-width="2" opacity=".75"/>
  <text x="800" y="230" text-anchor="middle" fill="#9aff00" font-family="Georgia,serif" font-size="54" letter-spacing="8">THE DEAD CODERS SOCIETY</text>
  <text x="800" y="360" text-anchor="middle" fill="#f3c55b" font-family="Georgia,serif" font-size="42">${escapeXml(type)} CERTIFICATE</text>
  <text x="800" y="520" text-anchor="middle" fill="#ffffff" font-family="Georgia,serif" font-size="88">${escapeXml(recipient)}</text>
  <text x="800" y="640" text-anchor="middle" fill="#d4d4d8" font-family="Arial,sans-serif" font-size="36">${escapeXml(title)}</text>
  <text x="800" y="720" text-anchor="middle" fill="#a1a1aa" font-family="Arial,sans-serif" font-size="30">${escapeXml(subtitle)}</text>
  <circle cx="800" cy="850" r="76" fill="none" stroke="#f3c55b" stroke-width="5"/>
  <text x="800" y="866" text-anchor="middle" fill="#f3c55b" font-family="Georgia,serif" font-size="34">TDCS</text>
</svg>`;
}
