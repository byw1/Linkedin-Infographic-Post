export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshUrl } from "@/lib/storage";
import { findDuplicateGroups } from "@/lib/duplicate-detector";

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  // Per-user library only — entities are user-scoped (UNIQUE userId,
  // slug). Pull every entity once; the detection set is small (low
  // hundreds even for power users) so an in-memory bucket is fine.
  const rows = await prisma.entity.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      slug: true,
      aliases: true,
      displayName: true,
      shapePreference: true,
      logoUrl: true,
      usageCount: true,
      sourceUrl: true,
    },
  });

  const groups = findDuplicateGroups(rows);

  // Refresh logo URLs only for the rows we're going to render. Keeps
  // the request cheap when there are no duplicates (the common case).
  const groupsOut = await Promise.all(
    groups.map(async (g) => ({
      id: g.id,
      reason: g.reason,
      members: await Promise.all(
        g.members.map(async (m) => ({
          ...m,
          logoUrl: (await refreshUrl(m.logoUrl)) ?? m.logoUrl,
        })),
      ),
    })),
  );

  return NextResponse.json({ groups: groupsOut });
}
