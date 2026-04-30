export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  FEED_SELECT,
  communityWhere,
  engagementRate,
  isCommunityMature,
  periodFilter,
  shapeFeedPost,
} from "@/lib/feed";

const Query = z.object({
  // Time window over which to look for wins. `tracked_at` filters
  // by when the user last logged metrics so a post tracked
  // yesterday counts toward this week even if it was rendered
  // years ago.
  period: z.enum(["all", "month", "week"]).default("month"),
  // How to rank: by reach (impressions) or by quality
  // (engagement rate = (reactions+comments+reposts)/impressions).
  sort: z.enum(["impressions", "engagement"]).default("engagement"),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

// Top performing shared posts across the community. Used by the
// /posts → Community Top sub-view and the homepage when we want a
// hero rail.
//
// Eligibility: the author has shareTracked enabled, the render is
// past its 7-day maturity window (see lib/feed.ts), and impressions
// is non-zero — without a denominator engagement rate is meaningless.
export async function GET(req: Request) {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    period: url.searchParams.get("period") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { period, sort, limit } = parsed.data;

  // For impressions-sort we order in SQL — fast, no over-fetch. For
  // engagement-sort we'd need a computed-column ORDER BY which Prisma
  // doesn't expose cleanly, so we fetch by impressions DESC (best
  // candidates for high engagement rate sit there too) and re-sort
  // in JS. Cap the over-fetch at limit*4 so a small pool can't blow
  // up the response — a community of a dozen won't have thousands of posts.
  const fetchLimit = sort === "engagement" ? Math.max(limit * 4, 50) : limit;

  const rows = await prisma.render.findMany({
    where: {
      user: { shareTracked: true },
      ...communityWhere(),
      impressions: { gt: 0 },
      ...periodFilter(period),
    },
    orderBy: { impressions: "desc" },
    // Bigger pad than before — the 7-day cross-column gate happens
    // in JS, so under-fetching would shrink the visible leaderboard.
    take: fetchLimit * 2,
    select: FEED_SELECT,
  });

  const mature = rows.filter(isCommunityMature);
  let ranked = mature;
  if (sort === "engagement") {
    ranked = [...mature].sort(
      (a, b) => (engagementRate(b) ?? 0) - (engagementRate(a) ?? 0),
    );
  }
  const posts = await Promise.all(ranked.slice(0, limit).map(shapeFeedPost));
  return NextResponse.json({ posts });
}
