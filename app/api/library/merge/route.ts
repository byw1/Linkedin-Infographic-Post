export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug-utils";

// Folds N entity rows into one. The canonical row keeps its id, slug,
// display name, logo, shape, and source URL (the "merge into THIS one"
// the user chose in the UI). The mergers' slugs and aliases are
// appended to the canonical's alias list so old posts and renders
// resolve through the canonical row, then the merger rows are deleted.
//
// Usage stats are summed (so merges don't lose history) and
// lastUsedAt takes the max across the group.
const Body = z.object({
  // The id of the row to keep. Required so two entities that share a
  // display name but should each remain separate (rare) never get
  // collapsed by accident.
  canonical_id: z.string().uuid(),
  // Ids of the rows to fold INTO the canonical. Any other rows in the
  // user's library are untouched.
  merge_ids: z.array(z.string().uuid()).min(1).max(20),
});

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { canonical_id, merge_ids } = parsed.data;
  if (merge_ids.includes(canonical_id)) {
    return NextResponse.json(
      { error: "Canonical id cannot also be in merge_ids." },
      { status: 400 },
    );
  }

  const allIds = [canonical_id, ...merge_ids];
  const rows = await prisma.entity.findMany({
    where: { id: { in: allIds }, userId: user.id },
  });
  if (rows.length !== allIds.length) {
    return NextResponse.json(
      { error: "One or more entities not found in your library." },
      { status: 404 },
    );
  }

  const canonical = rows.find((r) => r.id === canonical_id);
  const mergers = rows.filter((r) => r.id !== canonical_id);
  if (!canonical) {
    return NextResponse.json({ error: "Canonical not found." }, { status: 404 });
  }

  // Collect the new alias set: existing canonical aliases + every
  // merger's slug + their existing aliases. Normalize all of it so
  // future PATCH /api/entities/:slug edits can compare cleanly. Drop
  // the canonical's own slug — Prisma's unique check would reject
  // anyway and it's a no-op alias.
  const aliasSet = new Set<string>();
  for (const a of canonical.aliases) {
    const n = normalizeSlug(a);
    if (n) aliasSet.add(n);
  }
  for (const m of mergers) {
    const slugN = normalizeSlug(m.slug);
    if (slugN) aliasSet.add(slugN);
    for (const a of m.aliases) {
      const n = normalizeSlug(a);
      if (n) aliasSet.add(n);
    }
  }
  aliasSet.delete(normalizeSlug(canonical.slug));
  const newAliases = Array.from(aliasSet);

  const sumUsage = canonical.usageCount + mergers.reduce((s, m) => s + m.usageCount, 0);
  const maxLastUsedAt = [canonical.lastUsedAt, ...mergers.map((m) => m.lastUsedAt)]
    .filter((d): d is Date => Boolean(d))
    .reduce((max, d) => (d > max ? d : max), canonical.lastUsedAt);

  const updated = await prisma.$transaction(async (tx) => {
    // Delete mergers first so their slugs free up before we extend the
    // canonical's alias list (the alias array can't shadow another
    // entity's slug for the same user).
    await tx.entity.deleteMany({
      where: { id: { in: mergers.map((m) => m.id) }, userId: user.id },
    });
    return tx.entity.update({
      where: { id: canonical.id },
      data: {
        aliases: newAliases,
        usageCount: sumUsage,
        lastUsedAt: maxLastUsedAt,
      },
    });
  });

  return NextResponse.json({
    canonical: updated,
    merged_count: mergers.length,
  });
}
