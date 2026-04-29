export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractEntities } from "@/lib/parser";
import { refreshUrl } from "@/lib/storage";
import type { ResolvedEntity } from "@/types/entity";

const Body = z.object({
  slides: z
    .array(
      z.object({
        filename: z.string().max(200),
        html: z.string().min(1).max(2_000_000),
      }),
    )
    .min(1)
    .max(40),
});

interface SlideOut {
  filename: string;
  // Per-slide entities (slug + count) so the renderer knows which slugs
  // appear on which slide. We don't return per-slide resolved logos —
  // the client uses the deduped entities[] list as the global mapping.
  entities: { slug: string; count: number }[];
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Extract entities per slide; aggregate into a single dedup'd set keyed
  // by slug. Keep the strongest shape/size hint we see across slides.
  const slidesOut: SlideOut[] = [];
  const aggregate = new Map<
    string,
    { slug: string; count: number; shape_hint: "square" | "circle"; size_hint: number }
  >();

  for (const s of parsed.data.slides) {
    const extracted = extractEntities(s.html);
    slidesOut.push({
      filename: s.filename,
      entities: extracted.map((e) => ({ slug: e.slug, count: e.count })),
    });
    for (const e of extracted) {
      const prior = aggregate.get(e.slug);
      if (!prior) {
        aggregate.set(e.slug, { ...e });
      } else {
        prior.count += e.count;
        // Prefer "circle" if any slide hints at it (people > companies).
        if (e.shape_hint === "circle") prior.shape_hint = "circle";
        prior.size_hint = Math.max(prior.size_hint, e.size_hint);
      }
    }
  }

  const slugs = Array.from(aggregate.keys());
  // Resolve by canonical slug OR alias so `sama` finds the entity stored
  // under `sam-altman` if that's how the user named it.
  const known =
    slugs.length === 0
      ? []
      : await prisma.entity.findMany({
          where: {
            userId: user.id,
            OR: [{ slug: { in: slugs } }, { aliases: { hasSome: slugs } }],
          },
          select: { slug: true, aliases: true, logoUrl: true, displayName: true },
        });
  const knownMap = new Map<string, (typeof known)[number]>();
  for (const k of known) {
    knownMap.set(k.slug, k);
    for (const a of k.aliases) knownMap.set(a, k);
  }

  const entities: ResolvedEntity[] = await Promise.all(
    Array.from(aggregate.values()).map(async (e) => {
      const k = knownMap.get(e.slug);
      const logo_url = k ? ((await refreshUrl(k.logoUrl)) ?? k.logoUrl) : undefined;
      return {
        slug: e.slug,
        count: e.count,
        shape_hint: e.shape_hint,
        size_hint: e.size_hint,
        resolved: Boolean(k),
        logo_url,
        display_name: k?.displayName,
      };
    }),
  );
  // Keep deterministic order: most-used slugs first, ties alphabetical.
  entities.sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));

  return NextResponse.json({ slides: slidesOut, entities });
}
