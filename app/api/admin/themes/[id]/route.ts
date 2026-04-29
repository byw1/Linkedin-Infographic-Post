export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const PatchBody = z.object({
  isOfficial: z.boolean(),
});

// Admin-only "publish / unpublish" toggle. Authoring (rename, edit
// CSS, delete) goes through /api/themes/[id] — this route is purely
// for promoting a member's theme (or demoting one) without touching
// content or ownership.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const theme = await prisma.theme.update({
      where: { id: params.id },
      data: { isOfficial: parsed.data.isOfficial },
    });
    return NextResponse.json({ theme });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
