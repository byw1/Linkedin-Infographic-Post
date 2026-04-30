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

// Single-image renders top out around a few MB; multi-slide PDFs (carousel
// mode) can run 20–40 MB at 2× resolution, so the ceiling has to be
// considerably higher. Storage upload still streams the bytes, so the
// number is mostly there to bound malicious uploads.
const MAX_BYTES = 60 * 1024 * 1024; // 60 MB

const ALLOWED_TYPES = new Set(["image/png", "application/pdf"]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "application/pdf": "pdf",
};

const Meta = z.object({
  filename: z.string().max(120).optional(),
  entity_count: z.coerce.number().int().min(0).optional(),
  theme_id: z.string().uuid().optional(),
  // Render format. Optional with a "single" default for backwards
  // compatibility with the original infographic flow that doesn't
  // pass this. The tweet generator passes "tweet" for single-tweet
  // PNGs and "carousel" when it bundles a multi-tweet thread into
  // a PDF the user can post as a LinkedIn document carousel.
  format: z.enum(["single", "tweet", "carousel"]).optional(),
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
      { error: "Missing PNG/PDF blob under `file`." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${file.size} bytes; max ${MAX_BYTES}).` },
      { status: 413 },
    );
  }

  const contentType = file.type || "image/png";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `Unsupported content type: ${contentType}. Expected PNG or PDF.` },
      { status: 415 },
    );
  }

  const meta = Meta.safeParse({
    filename: form.get("filename") ?? undefined,
    entity_count: form.get("entity_count") ?? undefined,
    theme_id: form.get("theme_id") ?? undefined,
  });
  if (!meta.success) {
    return NextResponse.json({ error: meta.error.flatten() }, { status: 400 });
  }

  // Optional source HTML — when present, persisted on the Render
  // row so a Remix can re-open this post in the editor without
  // re-uploading from Claude. Same shape used by carousels (a
  // single-element slides array) so the loader is uniform.
  const sourceHtmlField = form.get("source_html");
  const sourceHtml =
    typeof sourceHtmlField === "string" && sourceHtmlField.length > 0
      ? sourceHtmlField
      : null;
  // Cap at 2 MB — typical Claude HTML is 50-200 KB, but a chart-heavy
  // page with inline base64 could grow. Anything bigger is suspect.
  const SOURCE_HTML_MAX = 2 * 1024 * 1024;
  if (sourceHtml && sourceHtml.length > SOURCE_HTML_MAX) {
    return NextResponse.json(
      { error: "Source HTML too large to remix (over 2 MB)." },
      { status: 413 },
    );
  }

  // Validate that the caller can actually use the theme they referenced
  // (their own or an official one). Bad ids drop silently to null —
  // the render still succeeds without a theme attribution.
  let themeIdToStore: string | null = null;
  if (meta.data.theme_id) {
    const theme = await prisma.theme.findUnique({
      where: { id: meta.data.theme_id },
      select: { id: true, userId: true, isOfficial: true },
    });
    if (theme && (theme.isOfficial || theme.userId === user.id)) {
      themeIdToStore = theme.id;
    }
  }

  const renderId = randomUUID();
  const ext = EXT_BY_TYPE[contentType];
  const key = `renders/${user.id}/${renderId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadFile(key, buffer, contentType);

  // The Render row keeps the public URL in pngUrl regardless of MIME so
  // the existing library / history paths keep working without a schema
  // change. The browser disambiguates by the file extension on the URL.
  const publicUrl = getBrowserUrl(key);
  await prisma.render.create({
    data: {
      id: renderId,
      userId: user.id,
      filename: meta.data.filename ?? null,
      entityCount: meta.data.entity_count ?? null,
      unknownCount: 0,
      status: "complete",
      pngUrl: publicUrl,
      completedAt: new Date(),
      themeId: themeIdToStore,
      format: meta.data.format ?? "single",
      sourceHtml: sourceHtml
        ? {
            slides: [
              {
                filename: meta.data.filename ?? "post.html",
                html: sourceHtml,
              },
            ],
          }
        : undefined,
    },
  });

  return NextResponse.json({
    render_id: renderId,
    png_url: publicUrl,
    status: "complete",
  });
}
