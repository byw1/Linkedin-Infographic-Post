export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug-utils";

const Body = z.object({
  slug: z.string().trim().min(1).max(120),
});

// Hide a slug from this user's library + pickers. Hidden slugs
// still resolve at parse time so HTML referencing them isn't
// broken; they just don't show up on /library or in the editor's
// "Recent logos" / "Use existing" surfaces. Idempotent.
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const slug = normalizeSlug(parsed.data.slug);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }
  await prisma.entityHidden.upsert({
    where: { userId_slug: { userId: user.id, slug } },
    create: { userId: user.id, slug },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

// Unhide — remove the override. Idempotent (delete-if-exists).
export async function DELETE(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const url = new URL(req.url);
  const rawSlug = url.searchParams.get("slug")?.trim();
  if (!rawSlug) {
    return NextResponse.json({ error: "Missing slug." }, { status: 400 });
  }
  const slug = normalizeSlug(rawSlug);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }
  await prisma.entityHidden.deleteMany({
    where: { userId: user.id, slug },
  });
  return NextResponse.json({ ok: true });
}
