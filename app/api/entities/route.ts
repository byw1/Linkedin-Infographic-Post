export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isStorageConfigured,
  refreshUrl,
  StorageNotConfiguredError,
  uploadFile,
} from "@/lib/storage";
import { normalizeSlug, slugToDisplayName } from "@/lib/slug-utils";

const FormSchema = z.object({
  slug: z.string().min(1).max(120),
  display_name: z.string().min(1).max(120).optional(),
  type: z
    .enum(["company", "person", "brand", "team", "product", "org", "other"])
    .default("company"),
  shape: z.enum(["square", "circle", "auto"]).default("square"),
  source_url: z.string().url().optional(),
});

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

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

  const contentType = req.headers.get("content-type") ?? "";
  let payload: {
    slug: string;
    display_name?: string;
    type: "company" | "person" | "brand" | "team" | "product" | "org" | "other";
    shape: "square" | "circle" | "auto";
    source_url?: string;
    fileBytes?: Buffer;
    fileType?: string;
    urlInput?: string;
  };

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const parsed = FormSchema.safeParse({
        slug: form.get("slug"),
        display_name: form.get("display_name") ?? undefined,
        type: form.get("type") ?? undefined,
        shape: form.get("shape") ?? undefined,
        source_url: form.get("source_url") ?? undefined,
      });
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const file = form.get("file");
      const url = form.get("url") as string | null;
      if (!file && !url) {
        return NextResponse.json({ error: "Provide either file or url." }, { status: 400 });
      }
      payload = { ...parsed.data };
      if (file && file instanceof Blob) {
        if (file.size > MAX_BYTES) {
          return NextResponse.json({ error: "File too large (max 5MB)." }, { status: 413 });
        }
        const blobType = file.type || "image/png";
        if (!ALLOWED_CONTENT_TYPES.has(blobType)) {
          return NextResponse.json({ error: `Unsupported file type: ${blobType}` }, { status: 415 });
        }
        payload.fileBytes = Buffer.from(await file.arrayBuffer());
        payload.fileType = blobType;
      } else if (url) {
        payload.urlInput = url;
      }
    } else {
      const json = await req.json();
      const parsed = FormSchema.extend({
        url: z.string().url().optional(),
        existing_slug: z.string().min(1).max(120).optional(),
      }).safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      // "Use existing logo from library" — copy logoUrl from another entity.
      if (parsed.data.existing_slug) {
        const sourceSlug = normalizeSlug(parsed.data.existing_slug);
        const targetSlug = normalizeSlug(parsed.data.slug);
        if (!sourceSlug || !targetSlug) {
          return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
        }
        const source = await prisma.entity.findUnique({
          where: { userId_slug: { userId: user.id, slug: sourceSlug } },
        });
        if (!source) {
          return NextResponse.json({ error: "Source entity not found." }, { status: 404 });
        }
        const entity = await prisma.entity.upsert({
          where: { userId_slug: { userId: user.id, slug: targetSlug } },
          create: {
            userId: user.id,
            slug: targetSlug,
            displayName: parsed.data.display_name ?? source.displayName,
            type: parsed.data.type ?? source.type,
            shapePreference: parsed.data.shape ?? source.shapePreference,
            logoUrl: source.logoUrl,
            sourceUrl: source.sourceUrl,
          },
          update: {
            displayName: parsed.data.display_name ?? undefined,
            type: parsed.data.type ?? undefined,
            shapePreference: parsed.data.shape ?? undefined,
            logoUrl: source.logoUrl,
            sourceUrl: source.sourceUrl ?? undefined,
          },
        });
        // Refresh to a browser-fetchable URL — same as the upload
        // paths below. Without this the editor receives the raw
        // canonical `<endpoint>/<bucket>/<key>` form, which a private
        // bucket can't serve directly, and the iframe shows a broken
        // image icon even though the logo is fine in the library
        // view (which already refreshes).
        const readableUrl = (await refreshUrl(source.logoUrl)) ?? source.logoUrl;
        return NextResponse.json({
          entity: { ...entity, logoUrl: readableUrl },
          logo_url: readableUrl,
        });
      }
      if (!parsed.data.url) {
        return NextResponse.json({ error: "Provide a url or existing_slug." }, { status: 400 });
      }
      payload = { ...parsed.data, urlInput: parsed.data.url };
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const slug = normalizeSlug(payload.slug);
  if (!slug) return NextResponse.json({ error: "Invalid slug." }, { status: 400 });

  let logoBytes: Buffer;
  let logoType: string;
  let sourceUrl = payload.source_url ?? payload.urlInput ?? null;

  if (payload.fileBytes && payload.fileType) {
    logoBytes = payload.fileBytes;
    logoType = payload.fileType;
  } else if (payload.urlInput) {
    try {
      const fetched = await fetch(payload.urlInput, { redirect: "follow" });
      if (!fetched.ok) {
        return NextResponse.json(
          { error: `Could not fetch url (${fetched.status}).` },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await fetched.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) {
        return NextResponse.json({ error: "Fetched image too large (max 5MB)." }, { status: 413 });
      }
      const ct = fetched.headers.get("content-type") ?? "image/png";
      if (!ALLOWED_CONTENT_TYPES.has(ct.split(";")[0].trim())) {
        return NextResponse.json({ error: `Unsupported content type: ${ct}` }, { status: 415 });
      }
      logoBytes = buf;
      logoType = ct.split(";")[0].trim();
    } catch (err) {
      return NextResponse.json(
        { error: `Could not fetch url: ${(err as Error).message}` },
        { status: 400 },
      );
    }
  } else {
    return NextResponse.json({ error: "No image source provided." }, { status: 400 });
  }

  const ext = extensionFor(logoType);
  const fingerprint = crypto.randomBytes(4).toString("hex");
  const key = `logos/${user.id}/${slug}-${fingerprint}${ext}`;
  let logoUrl: string;
  try {
    logoUrl = await uploadFile(key, logoBytes, logoType);
  } catch (err) {
    console.error(`[entities] uploadFile failed for ${key}`, err);
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: `Storage upload failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const entity = await prisma.entity.upsert({
    where: { userId_slug: { userId: user.id, slug } },
    create: {
      userId: user.id,
      slug,
      displayName: payload.display_name ?? slugToDisplayName(slug),
      type: payload.type,
      shapePreference: payload.shape,
      logoUrl,
      sourceUrl,
    },
    update: {
      displayName: payload.display_name ?? undefined,
      type: payload.type,
      shapePreference: payload.shape,
      logoUrl,
      sourceUrl: sourceUrl ?? undefined,
    },
  });

  // Re-sign so the client can immediately render a preview, even if the
  // bucket is private.
  const readableUrl = (await refreshUrl(logoUrl)) ?? logoUrl;
  return NextResponse.json(
    { entity: { ...entity, logoUrl: readableUrl }, logo_url: readableUrl },
  );
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}
