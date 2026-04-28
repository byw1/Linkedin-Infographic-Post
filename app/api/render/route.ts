export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getBrowserUrl,
  isStorageConfigured,
  StorageNotConfiguredError,
  uploadFile,
} from "@/lib/storage";
import { randomUUID } from "node:crypto";

const MAX_PNG_BYTES = 12 * 1024 * 1024; // 12 MB — generous; a 720×4000@2x PNG is well under

const Meta = z.object({
  filename: z.string().max(120).optional(),
  entity_count: z.coerce.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  if (!(await isStorageConfigured())) {
    return NextResponse.json(
      { error: new StorageNotConfiguredError().message },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a `file` field." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json(
      { error: "Missing PNG blob under `file`." },
      { status: 400 },
    );
  }
  if (file.size > MAX_PNG_BYTES) {
    return NextResponse.json(
      { error: `PNG too large (${file.size} bytes; max ${MAX_PNG_BYTES}).` },
      { status: 413 },
    );
  }

  const meta = Meta.safeParse({
    filename: form.get("filename") ?? undefined,
    entity_count: form.get("entity_count") ?? undefined,
  });
  if (!meta.success) {
    return NextResponse.json({ error: meta.error.flatten() }, { status: 400 });
  }

  const renderId = randomUUID();
  const key = `renders/${user.id}/${renderId}.png`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadFile(key, buffer, "image/png");

  await prisma.render.create({
    data: {
      id: renderId,
      userId: user.id,
      filename: meta.data.filename ?? null,
      entityCount: meta.data.entity_count ?? null,
      unknownCount: 0,
      status: "complete",
      pngUrl: getBrowserUrl(key),
      completedAt: new Date(),
    },
  });

  return NextResponse.json({
    render_id: renderId,
    png_url: getBrowserUrl(key),
    status: "complete",
  });
}
