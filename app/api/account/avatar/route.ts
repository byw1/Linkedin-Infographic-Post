export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  extractKeyFromUrl,
  isStorageConfigured,
  refreshUrl,
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

// Upload (or replace) the current user's profile picture. The
// previous avatar's S3 object is best-effort deleted so we don't
// accumulate orphans every time someone reuploads. Stored under
// `avatars/<userId>-<random>.<ext>` with a short fingerprint so a
// new file gets a unique URL — sidesteps any browser caching of
// the old avatar.
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
  const key = `avatars/${user.id}-${fingerprint}${ext}`;

  let storedUrl: string;
  try {
    storedUrl = await uploadFile(key, buffer, contentType);
  } catch (err) {
    return NextResponse.json(
      { error: `Storage upload failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Best-effort cleanup of the previous avatar object. Failures here
  // don't block the new avatar from going live — the row update
  // below is what users see.
  const previous = await prisma.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  });
  if (previous?.image) {
    void deleteFromStorage(previous.image).catch((err) => {
      console.error(`[avatar] previous-delete failed for ${user.id}`, err);
    });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { image: storedUrl },
    select: { id: true, image: true },
  });
  // Re-sign so the client can render the new avatar immediately on
  // private buckets.
  const readable = updated.image
    ? ((await refreshUrl(updated.image)) ?? updated.image)
    : null;
  return NextResponse.json({ image: readable });
}

// Remove the current user's profile picture. S3 object is
// best-effort deleted; the row update is what determines what
// renders.
export async function DELETE() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const previous = await prisma.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  });
  if (previous?.image) {
    void deleteFromStorage(previous.image).catch((err) => {
      console.error(`[avatar] delete failed for ${user.id}`, err);
    });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { image: null },
  });
  return NextResponse.json({ image: null });
}

async function deleteFromStorage(storedUrl: string): Promise<void> {
  const { storage } = await getSettings();
  if (!storage) return;
  const key = extractKeyFromUrl(storedUrl, storage);
  // Don't delete URLs that aren't ours — Google profile images,
  // for example, are external https URLs that won't extract a key.
  if (!key) return;
  // Also skip anything outside our `avatars/` prefix to be safe.
  if (!key.startsWith("avatars/")) return;
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
