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

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — tool logos are tiny

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/gif": ".gif",
};

// Upload (or replace) a tool's logo. Mirrors the avatar upload
// pattern — best-effort delete the previous logo from S3 to avoid
// orphans, store at `tools/<toolId>-<random>.<ext>` with a short
// fingerprint so a new file gets a unique URL (sidesteps browser
// caching of the old logo).
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

  const tool = await prisma.tool.findUnique({ where: { id: params.id } });
  if (!tool) {
    return NextResponse.json({ error: "Tool not found." }, { status: 404 });
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
  const key = `tools/${tool.id}-${fingerprint}${ext}`;

  let storedUrl: string;
  try {
    storedUrl = await uploadFile(key, buffer, contentType);
  } catch (err) {
    return NextResponse.json(
      { error: `Storage upload failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Best-effort cleanup of the previous logo. Only delete if it's
  // an S3-backed object we own; external URLs (favicons, hosted
  // brand pages) shouldn't be touched.
  if (tool.logoUrl) {
    try {
      const { storage } = await getSettings();
      if (storage) {
        const prevKey = extractKeyFromUrl(tool.logoUrl, storage);
        if (prevKey && prevKey.startsWith("tools/")) {
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
      console.error(`[tool:${tool.id}] previous-logo delete failed`, err);
    }
  }

  await prisma.tool.update({
    where: { id: tool.id },
    data: { logoUrl: storedUrl },
  });

  return NextResponse.json({ logoUrl: storedUrl });
}

// Clear the stored logo (revert to favicon fallback). Best-effort
// removes the S3 object so we don't accumulate orphans.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const tool = await prisma.tool.findUnique({ where: { id: params.id } });
  if (!tool) {
    return NextResponse.json({ error: "Tool not found." }, { status: 404 });
  }

  if (tool.logoUrl) {
    try {
      const { storage } = await getSettings();
      if (storage) {
        const key = extractKeyFromUrl(tool.logoUrl, storage);
        if (key && key.startsWith("tools/")) {
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
      console.error(`[tool:${tool.id}] logo delete failed`, err);
    }
  }

  await prisma.tool.update({
    where: { id: tool.id },
    data: { logoUrl: null },
  });

  return NextResponse.json({ ok: true });
}
