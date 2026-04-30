export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  FEED_SELECT,
  communityWhere,
  isCommunityMature,
  shapeFeedPost,
} from "@/lib/feed";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Recent shared posts across the community — the chronological
// feed for /posts → Community tab. Eligibility: author has
// shareTracked = true, post is at least 7 days past publishedAt,
// and tracking has been logged in that window (see
// isCommunityMature in lib/feed.ts for the exact rule).
//
// SQL handles the cheap necessary preconditions; the cross-column
// "trackedAt ≥ publishedAt + 7d" check happens in JS after fetch.
// We over-fetch by 2× the page size so the filter doesn't leave
// half-empty pages on most queries — fine for a private community.
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
      ...communityWhere(),
    },
    orderBy: [{ trackedAt: "desc" }, { id: "desc" }],
    take: limit * 2 + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: FEED_SELECT,
  });

  const mature = rows.filter(isCommunityMature);
  const hasMore = mature.length > limit;
  const page = hasMore ? mature.slice(0, limit) : mature;
  const posts = await Promise.all(page.map(shapeFeedPost));

  return NextResponse.json({
    posts,
    next_cursor: hasMore ? page[page.length - 1].id : null,
  });
}
