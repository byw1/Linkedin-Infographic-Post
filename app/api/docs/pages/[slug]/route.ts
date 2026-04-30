export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug-utils";

const RESERVED_SLUGS = new Set(["skills", "new"]);

// Get one page's full content — markdown + author metadata.
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }
  const slug = normalizeSlug(params.slug);
  const page = await prisma.docPage.findUnique({
    where: { slug },
    include: {
      updatedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ page });
}

const PatchBody = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().max(120).optional(),
  section: z.string().trim().max(120).nullable().optional(),
  markdown: z.string().max(200_000).optional(),
  // Manual position override. Sidebar shows pages in ascending
  // position order, so swapping two pages is two PATCHes that
  // exchange their position values.
  position: z.number().int().min(0).max(10_000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { slug: string } },
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const currentSlug = normalizeSlug(params.slug);
  const existing = await prisma.docPage.findUnique({ where: { slug: currentSlug } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {
    updatedById: admin.id,
  };
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.markdown !== undefined) data.markdown = parsed.data.markdown;
  if (parsed.data.position !== undefined) data.position = parsed.data.position;
  if (parsed.data.section !== undefined) {
    const trimmed = parsed.data.section?.trim();
    data.section = trimmed ? trimmed : null;
  }
  if (parsed.data.slug !== undefined) {
    const nextSlug = normalizeSlug(parsed.data.slug);
    if (!nextSlug) {
      return NextResponse.json(
        { error: "Slug is required and must contain at least one letter or digit." },
        { status: 400 },
      );
    }
    if (RESERVED_SLUGS.has(nextSlug)) {
      return NextResponse.json(
        { error: `"${nextSlug}" is reserved.` },
        { status: 409 },
      );
    }
    if (nextSlug !== currentSlug) data.slug = nextSlug;
  }

  try {
    const page = await prisma.docPage.update({
      where: { slug: currentSlug },
      data,
    });
    return NextResponse.json({ page });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: `Slug already in use.` },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const slug = normalizeSlug(params.slug);
  const existing = await prisma.docPage.findUnique({ where: { slug } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.docPage.delete({ where: { slug } });
  return NextResponse.json({ ok: true });
}
