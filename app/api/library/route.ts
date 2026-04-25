export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshUrl } from "@/lib/storage";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

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

  const rows = await prisma.entity.findMany({
    where: {
      userId: user.id,
      ...(search
        ? {
            OR: [
              { slug: { contains: search } },
              { displayName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy:
      sort === "name"
        ? [{ displayName: "asc" }, { id: "asc" }]
        : [{ lastUsedAt: "desc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const entities = await Promise.all(
    page.map(async (e) => ({
      ...e,
      logoUrl: (await refreshUrl(e.logoUrl)) ?? e.logoUrl,
    })),
  );

  return NextResponse.json({
    entities,
    next_cursor: hasMore ? page[page.length - 1].id : null,
  });
}
