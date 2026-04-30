export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SocialsSchema, TagsSchema, readSocials } from "@/lib/profile";

const Body = z.object({
  name: z.string().trim().min(1).max(80).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  tags: TagsSchema.optional(),
  socials: SocialsSchema.optional(),
  // Whether the user's tracked posts show up on the team-wide
  // feed (Wins, /posts team tab, member-card slideshow). Toggled
  // from /settings.
  share_tracked: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name ?? null;
  if (parsed.data.bio !== undefined) {
    const trimmed = parsed.data.bio?.trim();
    data.bio = trimmed ? trimmed : null;
  }
  if (parsed.data.tags !== undefined) data.tags = parsed.data.tags;
  if (parsed.data.socials !== undefined) data.socials = parsed.data.socials;
  if (parsed.data.share_tracked !== undefined) {
    data.shareTracked = parsed.data.share_tracked;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      bio: true,
      tags: true,
      socials: true,
      shareTracked: true,
    },
  });
  return NextResponse.json({
    user: { ...updated, socials: readSocials(updated.socials) },
  });
}
