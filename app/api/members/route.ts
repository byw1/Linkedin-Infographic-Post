export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { memberStatsByUser } from "@/lib/member-stats";
import { readSocials } from "@/lib/profile";
import { refreshUrl } from "@/lib/storage";

export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const url = new URL(req.url);
  const tag = url.searchParams.get("tag")?.trim().toLowerCase() ?? "";

  const rows = await prisma.user.findMany({
    where: tag ? { tags: { has: tag } } : undefined,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      tags: true,
      bio: true,
      socials: true,
      createdAt: true,
      shareTracked: true,
    },
  });

  // Batch-load tracked-post stats for every member in one query
  // instead of N round-trips. Stats are computed regardless of
  // shareTracked so a member's own profile view always sees the
  // full numbers; the directory hides stats on cards belonging to
  // members who've opted out of sharing.
  const stats = await memberStatsByUser(rows.map((r) => r.id));

  // Avatars stored on S3 (anything our uploadFile created) need a
  // browser-fetchable URL. External images (Google profile, etc.)
  // pass through unchanged because extractKeyFromUrl returns null
  // for them and refreshUrl falls back to the original.
  const members = await Promise.all(
    rows.map(async (m) => ({
      id: m.id,
      name: m.name,
      // Email is shown to other signed-in members so they can DM.
      // If you wanted to gate that, mask it for non-self / non-admin
      // here.
      email: m.email,
      image: m.image ? ((await refreshUrl(m.image)) ?? m.image) : null,
      role: m.role,
      tags: m.tags,
      bio: m.bio,
      socials: readSocials(m.socials),
      createdAt: m.createdAt,
      isSelf: m.id === user.id,
      shareTracked: m.shareTracked,
      stats: stats[m.id] ?? {
        postsShared: 0,
        totalImpressions: 0,
        avgEngagementRate: null,
        lastTrackedAt: null,
      },
    })),
  );

  return NextResponse.json({ members });
}
