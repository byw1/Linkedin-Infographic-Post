export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractEntities, hashHtml } from "@/lib/parser";
import { cacheParse, getCachedParse } from "@/lib/cache";
import { refreshUrl } from "@/lib/storage";
import type { ResolvedEntity } from "@/types/entity";

const Body = z.object({
  html: z.string().min(1).max(2_000_000),
});

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

  const html = parsed.data.html;
  const hash = hashHtml(`${user.id}:${html}`);

  const cached = await getCachedParse<ResolvedEntity[]>(hash);
  if (cached) {
    // Re-sign URLs in case the cached ones expired.
    const refreshed = await Promise.all(
      cached.map(async (e) => ({
        ...e,
        logo_url: e.logo_url ? ((await refreshUrl(e.logo_url)) ?? e.logo_url) : undefined,
      })),
    );
    return NextResponse.json({ hash, entities: refreshed });
  }

  const extracted = extractEntities(html);
  const slugs = extracted.map((e) => e.slug);
  // Look up by canonical slug OR alias — a logo uploaded as `sam-altman`
  // should still resolve when an HTML uses `sama` if `sama` is in its
  // alias list.
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

  const resolved: ResolvedEntity[] = await Promise.all(
    extracted.map(async (e) => {
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

  // Cache the parse result (with the underlying stored URL) — we re-sign on
  // hit. We strip the volatile signature here so the cache key is stable.
  await cacheParse(
    hash,
    resolved.map((e) => ({ ...e, logo_url: knownMap.get(e.slug)?.logoUrl ?? e.logo_url })),
  );
  return NextResponse.json({ hash, entities: resolved });
}
