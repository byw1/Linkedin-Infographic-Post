export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Soft-ban toggle. POST { banned: true } → bannedAt = now, blocks
// sign-in and hides from non-admin listings. POST { banned: false }
// → unban, restore access. Reversible by design.
const Body = z.object({ banned: z.boolean() });

export async function POST(
  req: Request,
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
      { error: "You can't ban yourself." },
      { status: 400 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { bannedAt: parsed.data.banned ? new Date() : null },
      select: { id: true, bannedAt: true },
    });
    // Sign-out side: NextAuth JWTs are stateless, so a banned
    // member can keep using a tab they're already on until their
    // next request — at which point requireUser re-checks bannedAt
    // and 401s. Good enough; no JWT revocation table needed.
    return NextResponse.json({ id: updated.id, banned: updated.bannedAt !== null });
  } catch {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
}
