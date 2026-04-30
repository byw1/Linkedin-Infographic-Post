export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { memberStats } from "@/lib/member-stats";
import { readSocials } from "@/lib/profile";
import { refreshUrl } from "@/lib/storage";

// One member's profile + stats. Used by /members/[id]. Stats are
// always returned in full so a member viewing their own profile
// sees their numbers even when sharing is off; the consumer page
// hides them on other members' profiles when shareTracked is false
// (mirrors the directory-card behavior).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const m = await prisma.user.findUnique({
    where: { id: params.id },
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
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stats = await memberStats(m.id);

  const image = m.image ? ((await refreshUrl(m.image)) ?? m.image) : null;
  return NextResponse.json({
    member: {
      id: m.id,
      name: m.name,
      email: m.email,
      image,
      role: m.role,
      tags: m.tags,
      bio: m.bio,
      socials: readSocials(m.socials),
      createdAt: m.createdAt,
      isSelf: m.id === user.id,
      shareTracked: m.shareTracked,
      stats,
    },
  });
}
