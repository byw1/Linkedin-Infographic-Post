export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";

const PatchBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description ?? null;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  try {
    const skill = await prisma.skill.update({ where: { id: params.id }, data });
    return NextResponse.json({ skill });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const skill = await prisma.skill.findUnique({ where: { id: params.id } });
  if (!skill) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort S3 cleanup — if the object is already gone we still
  // remove the metadata row.
  try {
    const { storage } = await getSettings();
    if (storage) {
      const client = new S3Client({
        region: storage.region,
        endpoint: storage.endpoint,
        forcePathStyle: storage.forcePathStyle,
        credentials: {
          accessKeyId: storage.accessKey,
          secretAccessKey: storage.secretKey,
        },
      });
      await client.send(
        new DeleteObjectCommand({ Bucket: storage.bucket, Key: skill.storageKey }),
      );
    }
  } catch (err) {
    console.error(`[skills] failed to delete object ${skill.storageKey}`, err);
  }

  await prisma.skill.delete({ where: { id: skill.id } });
  return NextResponse.json({ ok: true });
}
