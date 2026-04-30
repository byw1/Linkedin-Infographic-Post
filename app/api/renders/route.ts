export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshUrl } from "@/lib/storage";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// User-scoped list of past renders. Used by /posts to show what
// you've made and let you reopen any of them via Remix. We
// re-sign the rendered PNG/PDF URLs at request time so private
// buckets continue to serve through the proxy as the row ages.
//
// `has_source` flags whether the row carries source HTML (and is
// therefore remixable). Legacy renders before the source-html
// migration won't have it; the UI hides Remix on those.
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const url = new URL(req.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
  );
  const cursor = url.searchParams.get("cursor") ?? null;

  const rows = await prisma.render.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      filename: true,
      pngUrl: true,
      status: true,
      format: true,
      sourceHtml: true,
      createdAt: true,
      completedAt: true,
      entityCount: true,
      postUrl: true,
      impressions: true,
      reactions: true,
      comments: true,
      reposts: true,
      trackedAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const renders = await Promise.all(
    page.map(async (r) => ({
      id: r.id,
      filename: r.filename,
      url: r.pngUrl ? ((await refreshUrl(r.pngUrl)) ?? r.pngUrl) : null,
      status: r.status,
      format: r.format,
      hasSource: r.sourceHtml !== null,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      entityCount: r.entityCount,
      tracking: {
        post_url: r.postUrl,
        impressions: r.impressions,
        reactions: r.reactions,
        comments: r.comments,
        reposts: r.reposts,
        tracked_at: r.trackedAt,
      },
    })),
  );

  return NextResponse.json({
    renders,
    next_cursor: hasMore ? page[page.length - 1].id : null,
  });
}
