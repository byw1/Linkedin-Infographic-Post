export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug-utils";
import { refreshUrl } from "@/lib/storage";

const PatchBody = z.object({
  display_name: z.string().trim().min(1).max(120).optional(),
  type: z
    .enum(["company", "person", "brand", "team", "product", "org", "other"])
    .optional(),
  shape: z.enum(["square", "circle", "auto"]).optional(),
  // Rename canonical slug. The old slug is automatically appended to
  // aliases so existing posts and renders still resolve.
  slug: z.string().trim().min(1).max(80).optional(),
  // Replace aliases wholesale. Empty array = clear.
  aliases: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const slug = normalizeSlug(params.slug);
  const entity = await prisma.entity.findUnique({
    where: { userId_slug: { userId: user.id, slug } },
  });
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const logoUrl = (await refreshUrl(entity.logoUrl)) ?? entity.logoUrl;
  return NextResponse.json({ entity: { ...entity, logoUrl } });
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const currentSlug = normalizeSlug(params.slug);
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.entity.findUnique({
    where: { userId_slug: { userId: user.id, slug: currentSlug } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.display_name !== undefined) data.displayName = parsed.data.display_name;
  if (parsed.data.type) data.type = parsed.data.type;
  if (parsed.data.shape) data.shapePreference = parsed.data.shape;

  // Build the post-update slug + aliases together — we need to validate
  // the combined set against other rows in one shot.
  let nextSlug = existing.slug;
  let nextAliases: string[] = existing.aliases;

  if (parsed.data.slug !== undefined) {
    const renamed = normalizeSlug(parsed.data.slug);
    if (!renamed) {
      return NextResponse.json(
        { error: "Slug must contain at least one alphanumeric character." },
        { status: 400 },
      );
    }
    if (renamed !== existing.slug) {
      // Demote the old canonical slug to an alias so old posts still
      // auto-resolve. Dedup against whatever the user submitted in
      // `aliases`, applied below.
      nextSlug = renamed;
      nextAliases = [...nextAliases, existing.slug];
    }
  }

  if (parsed.data.aliases !== undefined) {
    const fromUser = parsed.data.aliases.map(normalizeSlug).filter(Boolean);
    nextAliases = parsed.data.slug !== undefined
      ? // When renaming, preserve the auto-demoted old slug + user's set
        Array.from(new Set([...nextAliases, ...fromUser]))
      : Array.from(new Set(fromUser));
  } else {
    nextAliases = Array.from(new Set(nextAliases));
  }

  // Aliases must not equal the canonical slug or include any duplicates
  // pointing at the same row (Postgres won't reject those for us).
  nextAliases = nextAliases.filter((a) => a !== nextSlug);

  // Cross-row collision check: nothing else owned by this user can hold
  // the new slug as its slug or as an alias, and nothing else can claim
  // any of our aliases.
  if (parsed.data.slug !== undefined || parsed.data.aliases !== undefined) {
    const candidates = Array.from(new Set([nextSlug, ...nextAliases]));
    if (candidates.length > 0) {
      const collisions = await prisma.entity.findMany({
        where: {
          userId: user.id,
          id: { not: existing.id },
          OR: [
            { slug: { in: candidates } },
            { aliases: { hasSome: candidates } },
          ],
        },
        select: { slug: true, aliases: true },
      });
      if (collisions.length > 0) {
        const taken = new Set<string>();
        for (const c of collisions) {
          for (const cand of candidates) {
            if (c.slug === cand || c.aliases.includes(cand)) taken.add(cand);
          }
        }
        return NextResponse.json(
          {
            error: `Already in use by another entity: ${Array.from(taken).join(", ")}.`,
          },
          { status: 409 },
        );
      }
    }
    if (nextSlug !== existing.slug) data.slug = nextSlug;
    data.aliases = nextAliases;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const entity = await prisma.entity.update({
      where: { id: existing.id },
      data,
    });
    return NextResponse.json({ entity });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Slug already in use by another entity." },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const slug = normalizeSlug(params.slug);
  try {
    await prisma.entity.delete({
      where: { userId_slug: { userId: user.id, slug } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
