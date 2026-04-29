export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readSocials } from "@/lib/profile";

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
    },
  });

  const members = rows.map((m) => ({
    id: m.id,
    name: m.name,
    // Email is shown to other signed-in members so they can DM. If you
    // wanted to gate that, mask it for non-self / non-admin here.
    email: m.email,
    image: m.image,
    role: m.role,
    tags: m.tags,
    bio: m.bio,
    socials: readSocials(m.socials),
    createdAt: m.createdAt,
    isSelf: m.id === user.id,
  }));

  return NextResponse.json({ members });
}
