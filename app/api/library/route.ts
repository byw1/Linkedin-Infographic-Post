export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshUrl } from "@/lib/storage";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

// Community-wide library. Every member sees every uploaded logo,
// deduped by slug — if Sarah and Alex both uploaded `microsoft`,
// the highest-usage row wins on display, with attribution to the
// original uploader. Members can hide individual slugs from their
// own view via /api/library/hide; hidden slugs still resolve at
// parse time so HTML referencing them isn't broken.
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
  const sort = url.searchParams.get("sort") === "name" ? "name" : "last_used";
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
  );
  const cursor = url.searchParams.get("cursor") ?? null;

  // Slugs the current user has hidden — pulled first so we can
  // exclude them from the entity query in one round trip.
  const hidden = await prisma.entityHidden.findMany({
    where: { userId: user.id },
    select: { slug: true },
  });
  const hiddenSlugs = new Set(hidden.map((h) => h.slug));

  // Distinct on `slug` keeps one row per slug, picked by the orderBy:
  // slug ASC (required as the first key when distinct is set), then
  // usageCount DESC so the most-used row wins, with lastUsedAt as a
  // tiebreak. We re-sort the result by the user's chosen sort below.
  const allDeduped = await prisma.entity.findMany({
    distinct: ["slug"],
    where: {
      ...(hiddenSlugs.size > 0
        ? { slug: { notIn: Array.from(hiddenSlugs) } }
        : {}),
      ...(search
        ? {
            OR: [
              { slug: { contains: search } },
              { displayName: { contains: search, mode: "insensitive" } },
              // Aliases match too — searching "sama" should find an
              // entity stored as "sam-altman" if `sama` is in its
              // alias list.
              { aliases: { has: search } },
            ],
          }
        : {}),
    },
    orderBy: [
      { slug: "asc" },
      { usageCount: "desc" },
      { lastUsedAt: "desc" },
    ],
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // Re-order for display per the user's sort. Cursor pagination
  // works on this final ordering — we slice in JS since the
  // distinct + secondary sort means SQL-level cursoring would be
  // tricky to keep stable.
  const sorted = [...allDeduped].sort((a, b) => {
    if (sort === "name") {
      const an = a.displayName.toLowerCase();
      const bn = b.displayName.toLowerCase();
      const c = an.localeCompare(bn);
      return c !== 0 ? c : a.id.localeCompare(b.id);
    }
    const at = a.lastUsedAt.getTime();
    const bt = b.lastUsedAt.getTime();
    if (at !== bt) return bt - at;
    return a.id.localeCompare(b.id);
  });

  let startIndex = 0;
  if (cursor) {
    const idx = sorted.findIndex((e) => e.id === cursor);
    startIndex = idx >= 0 ? idx + 1 : 0;
  }
  const slice = sorted.slice(startIndex, startIndex + limit + 1);
  const hasMore = slice.length > limit;
  const page = hasMore ? slice.slice(0, limit) : slice;

  const entities = await Promise.all(
    page.map(async (e) => ({
      id: e.id,
      slug: e.slug,
      aliases: e.aliases,
      displayName: e.displayName,
      type: e.type,
      shapePreference: e.shapePreference,
      logoUrl: (await refreshUrl(e.logoUrl)) ?? e.logoUrl,
      sourceUrl: e.sourceUrl,
      usageCount: e.usageCount,
      lastUsedAt: e.lastUsedAt,
      createdAt: e.createdAt,
      // Who originally uploaded this. The directory shows
      // attribution next to the name and uses ownership to gate
      // edit/delete buttons.
      uploadedBy: e.user
        ? { id: e.user.id, name: e.user.name, email: e.user.email }
        : null,
      isMine: e.userId === user.id,
    })),
  );

  return NextResponse.json({
    entities,
    next_cursor: hasMore ? page[page.length - 1].id : null,
  });
}
