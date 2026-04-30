export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SocialsSchema, TagsSchema, readSocials } from "@/lib/profile";

// Admin-only edit of another member's profile. Mirrors
// /api/account/profile but accepts a target id from the URL and
// permits role + share_tracked changes (since admins manage roles).
const Body = z.object({
  name: z.string().trim().min(1).max(80).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  tags: TagsSchema.optional(),
  socials: SocialsSchema.optional(),
  share_tracked: z.boolean().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Don't let an admin demote themselves. Without this they could
  // end up with no admins in the workspace and lose access to admin
  // tools.
  if (params.id === admin.id && parsed.data.role === "user") {
    return NextResponse.json(
      { error: "You can't demote yourself. Promote another admin first." },
      { status: 400 },
    );
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
  if (parsed.data.role !== undefined) data.role = parsed.data.role;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: params.id },
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
  } catch {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
}

// Permanent delete. Cascades through all owned content (renders,
// entities, themes, sessions, accounts, hide overrides) per the
// schema's onDelete: Cascade rules. The directory removes the row
// entirely on success — preferred over ban when the admin actually
// wants the data gone.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  if (params.id === admin.id) {
    return NextResponse.json(
      { error: "You can't delete your own account from here." },
      { status: 400 },
    );
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
}
