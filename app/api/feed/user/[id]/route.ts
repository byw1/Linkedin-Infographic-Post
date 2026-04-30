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
  shapeFeedPost,
} from "@/lib/feed";

const Query = z.object({
  // Top by quality (engagement rate) by default — that's what a
  // member-card slideshow wants, "their best stuff." `recent` is
  // an alternate ordering for the profile page.
  sort: z.enum(["engagement", "impressions", "recent"]).default("engagement"),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

// Top shared posts for a specific user. Used by member cards on
// /members for the slideshow rail. Returns nothing if the target
// user has shareTracked = false — the request is allowed (any
// signed-in user can ask) but the response is empty so the UI
// hides the rail.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    sort: url.searchParams.get("sort") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { sort, limit } = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, shareTracked: true },
  });
  if (!target || !target.shareTracked) {
    return NextResponse.json({ posts: [] });
  }

  const fetchLimit = sort === "engagement" ? Math.max(limit * 4, 20) : limit;
  const orderBy =
    sort === "recent"
      ? ({ trackedAt: "desc" } as const)
      : ({ impressions: "desc" } as const);

  const rows = await prisma.render.findMany({
    where: {
      userId: params.id,
      ...communityWhere(),
      impressions: { gt: 0 },
    },
    orderBy,
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
