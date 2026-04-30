export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug-utils";

// Slugs we won't let admins claim because the docs UI uses them
// for built-in surfaces (Skills tab, etc.). Keep this short — every
// reservation is a name we've stolen from the team's vocabulary.
const RESERVED_SLUGS = new Set(["skills", "new"]);

// List every wiki page in sidebar order. Title + slug + section
// only — the page body is fetched on demand from /api/docs/pages/
// [slug] so the sidebar payload stays small as the handbook grows.
export async function GET() {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }
  const pages = await prisma.docPage.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      section: true,
      position: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ pages });
}

const CreateBody = z.object({
  title: z.string().trim().min(1).max(120),
  // Optional explicit slug; otherwise derived from title. Lower-
  // case, hyphenated, ascii-only via normalizeSlug.
  slug: z.string().trim().max(120).optional(),
  section: z.string().trim().max(120).nullable().optional(),
  markdown: z.string().max(200_000).optional(),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const slug = normalizeSlug(parsed.data.slug || parsed.data.title);
  if (!slug) {
    return NextResponse.json({ error: "Couldn't derive a slug from that title." }, { status: 400 });
  }
  if (RESERVED_SLUGS.has(slug)) {
    return NextResponse.json(
      { error: `"${slug}" is reserved. Pick a different slug.` },
      { status: 409 },
    );
  }

  // Append at the end of the sidebar by default. If the table is
  // empty `_max.position` is null → start at 0.
  const last = await prisma.docPage.aggregate({ _max: { position: true } });
  const position = (last._max.position ?? -1) + 1;

  try {
    const page = await prisma.docPage.create({
      data: {
        slug,
        title: parsed.data.title,
        section: parsed.data.section?.trim() || null,
        markdown: parsed.data.markdown ?? `# ${parsed.data.title}\n\n`,
        position,
        updatedById: admin.id,
      },
    });
    return NextResponse.json({ page });
  } catch (err) {
    // Unique constraint on slug — return a friendly error so the UI
    // can prompt for a different slug.
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: `A page with slug "${slug}" already exists.` },
        { status: 409 },
      );
    }
    throw err;
  }
}
