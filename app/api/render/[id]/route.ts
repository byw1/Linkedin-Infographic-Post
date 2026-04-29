export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractKeyFromUrl, refreshUrl } from "@/lib/storage";
import { getSettings } from "@/lib/settings";

interface TrackingShape {
  postUrl: string | null;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  trackedAt: Date | null;
}

function shapeRender(
  render: {
    id: string;
    status: string;
    errorMessage: string | null;
    pngUrl: string | null;
    filename: string | null;
  } & TrackingShape,
  url: string | null,
) {
  return {
    id: render.id,
    status: render.status,
    url,
    error_message: render.errorMessage,
    filename: render.filename,
    tracking: {
      post_url: render.postUrl,
      impressions: render.impressions,
      reactions: render.reactions,
      comments: render.comments,
      reposts: render.reposts,
      tracked_at: render.trackedAt,
    },
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const render = await prisma.render.findUnique({ where: { id: params.id } });
  if (!render || render.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = render.pngUrl ? ((await refreshUrl(render.pngUrl)) ?? render.pngUrl) : null;
  return NextResponse.json(shapeRender(render, url));
}

const PatchBody = z.object({
  post_url: z.string().trim().url().nullable().optional(),
  impressions: z.coerce.number().int().min(0).max(2_000_000_000).nullable().optional(),
  reactions: z.coerce.number().int().min(0).max(2_000_000_000).nullable().optional(),
  comments: z.coerce.number().int().min(0).max(2_000_000_000).nullable().optional(),
  reposts: z.coerce.number().int().min(0).max(2_000_000_000).nullable().optional(),
});

// Manual tracking write. Any subset of fields can be patched; sending
// `null` clears a field. Stamps `tracked_at` whenever any tracking
// field actually changes so we know when the user last logged metrics.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const render = await prisma.render.findUnique({ where: { id: params.id } });
  if (!render || render.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.post_url !== undefined) data.postUrl = parsed.data.post_url;
  if (parsed.data.impressions !== undefined) data.impressions = parsed.data.impressions;
  if (parsed.data.reactions !== undefined) data.reactions = parsed.data.reactions;
  if (parsed.data.comments !== undefined) data.comments = parsed.data.comments;
  if (parsed.data.reposts !== undefined) data.reposts = parsed.data.reposts;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  data.trackedAt = new Date();

  const updated = await prisma.render.update({
    where: { id: render.id },
    data,
  });
  const url = updated.pngUrl ? ((await refreshUrl(updated.pngUrl)) ?? updated.pngUrl) : null;
  return NextResponse.json(shapeRender(updated, url));
}

// Permanent delete: removes the file from S3 (best-effort) and the
// row. Owner-only. Useful to clean up failed attempts or test
// renders that the user doesn't want sitting in their history.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const render = await prisma.render.findUnique({ where: { id: params.id } });
  if (!render || render.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (render.pngUrl) {
    try {
      const { storage } = await getSettings();
      if (storage) {
        const key = extractKeyFromUrl(render.pngUrl, storage);
        if (key) {
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
      console.error(`[render:${render.id}] storage delete failed`, err);
    }
  }

  await prisma.render.delete({ where: { id: render.id } });
  return NextResponse.json({ ok: true });
}
