export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  extractKeyFromUrl,
  isStorageConfigured,
  StorageNotConfiguredError,
  uploadFile,
} from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — typical avatar is well under

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// Admin-side avatar management for another member. Mirrors
// /api/account/avatar but accepts a target user id from the URL
// and gates on requireAdmin. Stored under
// `avatars/<targetUserId>-<random>.<ext>` so the existing
// proxy-prefix rules continue to grant cross-member read.
//
// Best-effort cleanup of the previous avatar so we don't accumulate
// orphans when an admin re-uploads.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  if (!(await isStorageConfigured())) {
    return NextResponse.json(
      { error: new StorageNotConfiguredError().message },
      { status: 503 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
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
    return NextResponse.json({ error: "Missing image file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image too large (max ${MAX_BYTES / (1024 * 1024)} MB).` },
      { status: 413 },
    );
  }
  const contentType = file.type || "image/png";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `Unsupported type: ${contentType}.` },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fingerprint = crypto.randomBytes(4).toString("hex");
  const ext = EXT_BY_TYPE[contentType];
  const key = `avatars/${target.id}-${fingerprint}${ext}`;

  let storedUrl: string;
  try {
    storedUrl = await uploadFile(key, buffer, contentType);
  } catch (err) {
    return NextResponse.json(
      { error: `Storage upload failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Best-effort delete the previous file. Only touch S3 objects
  // we own (avatars/ prefix) — external Google profile images
  // shouldn't be touched.
  if (target.image) {
    try {
      const { storage } = await getSettings();
      if (storage) {
        const prevKey = extractKeyFromUrl(target.image, storage);
        if (prevKey && prevKey.startsWith("avatars/")) {
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
            new DeleteObjectCommand({ Bucket: storage.bucket, Key: prevKey }),
          );
        }
      }
    } catch (err) {
      console.error(`[admin/avatar:${target.id}] previous-avatar delete failed`, err);
    }
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { image: storedUrl },
  });

  return NextResponse.json({ image: storedUrl });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (target.image) {
    try {
      const { storage } = await getSettings();
      if (storage) {
        const key = extractKeyFromUrl(target.image, storage);
        if (key && key.startsWith("avatars/")) {
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
            new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }),
          );
        }
      }
    } catch (err) {
      console.error(`[admin/avatar:${target.id}] avatar delete failed`, err);
    }
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { image: null },
  });

  return NextResponse.json({ ok: true });
}
