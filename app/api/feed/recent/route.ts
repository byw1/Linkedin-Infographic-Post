export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEED_SELECT, shapeFeedPost } from "@/lib/feed";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Recent shared posts across the team — the chronological feed for
// /posts → Team tab. Eligibility mirrors /api/feed/wins (author
// shareTracked = true, trackedAt set), so untracked drafts don't
// leak. Cursor-based pagination on the trackedAt timestamp + id
// tiebreak.
export async function GET(req: Request) {
  try {
    await requireUser();
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
    where: {
      user: { shareTracked: true },
      trackedAt: { not: null },
    },
    orderBy: [{ trackedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: FEED_SELECT,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const posts = await Promise.all(page.map(shapeFeedPost));

  return NextResponse.json({
    posts,
    next_cursor: hasMore ? page[page.length - 1].id : null,
  });
}
