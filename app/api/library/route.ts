export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  const entities = await prisma.entity.findMany({
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
        ? { displayName: "asc" }
        : [{ lastUsedAt: "desc" }, { displayName: "asc" }],
    take: 500,
  });

  return NextResponse.json({ entities });
}
