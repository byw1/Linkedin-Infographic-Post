export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBrowserUrl } from "@/lib/storage";

// Listing is open to any signed-in user — skills are team-shared. The
// download URL is the same /api/files/<key> proxy used for logos and
// renders, just with a "skills/" prefix; auth still required.
export async function GET() {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }
  const skills = await prisma.skill.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      filename: true,
      storageKey: true,
      fileSize: true,
      createdAt: true,
      updatedAt: true,
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
  return NextResponse.json({
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      filename: s.filename,
      fileSize: s.fileSize,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      uploadedBy: s.uploadedBy,
      downloadUrl: getBrowserUrl(s.storageKey),
    })),
  });
}
