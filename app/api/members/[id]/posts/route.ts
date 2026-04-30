export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEED_SELECT, shapeFeedPost } from "@/lib/feed";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

// Paginated list of one member's tracked posts. Used by their
// profile page (`/members/[id]`). Shows everything if the caller is
// the member themselves; otherwise honors shareTracked — non-self
// requests against a private member return an empty list rather
// than a 403 so the page renders cleanly.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, shareTracked: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSelf = target.id === user.id;
  if (!target.shareTracked && !isSelf) {
    return NextResponse.json({ posts: [], next_cursor: null });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
  );
  const cursor = url.searchParams.get("cursor") ?? null;

  const rows = await prisma.render.findMany({
    where: {
      userId: target.id,
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
