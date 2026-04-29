export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStorageConfigured, StorageNotConfiguredError, uploadFile } from "@/lib/storage";
import { parseSkillFrontmatter } from "@/lib/skill-parser";
import { randomUUID } from "node:crypto";

const MAX_BYTES = 1 * 1024 * 1024; // 1 MB — even verbose skills sit well under

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
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
      { error: "Missing skill file under `file`." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Skill file too large (${file.size} bytes; max ${MAX_BYTES}).` },
      { status: 413 },
    );
  }

  // Pull the original filename off the FormDataEntryValue when possible,
  // otherwise synthesize one. Browsers ship the file's name on the Blob's
  // `.name` getter; FormDataEntryValue widens the type so we narrow.
  const browserFilename = (file as Blob & { name?: string }).name ?? "skill.md";
  if (!/\.(md|markdown)$/i.test(browserFilename)) {
    return NextResponse.json(
      { error: "Skill files must be .md or .markdown." },
      { status: 415 },
    );
  }

  const text = await file.text();
  const frontmatter = parseSkillFrontmatter(text);

  // Allow the admin to override name/description from the form, falling
  // back to the parsed frontmatter, then to the filename.
  const formName = (form.get("name") as string | null)?.trim();
  const formDescription = (form.get("description") as string | null)?.trim();
  const name =
    formName ||
    frontmatter.name ||
    browserFilename.replace(/\.(md|markdown)$/i, "") ||
    "skill";
  const description = formDescription || frontmatter.description || null;

  const id = randomUUID();
  const storageKey = `skills/${id}.md`;
  const buffer = Buffer.from(text, "utf-8");
  await uploadFile(storageKey, buffer, "text/markdown; charset=utf-8");

  const skill = await prisma.skill.create({
    data: {
      id,
      name,
      description,
      filename: browserFilename,
      storageKey,
      fileSize: buffer.byteLength,
      uploadedById: admin.id,
    },
  });

  return NextResponse.json({ skill });
}
