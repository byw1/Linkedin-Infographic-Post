export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractFontFamily, parseTokens } from "@/lib/themes";

const MAX_CSS_BYTES = 64 * 1024;

const CreateBody = z.object({
  name: z.string().trim().min(1).max(80),
  css: z.string().trim().min(1).max(MAX_CSS_BYTES),
  // Admins creating from /admin/themes default to "official". They
  // can still create personal drafts by passing false.
  isOfficial: z.boolean().optional(),
});

// Admin-only listing: every theme on the system, with owner email.
// Members hit /api/themes for the filtered (own + official) view.
export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const themes = await prisma.theme.findMany({
    orderBy: [{ isOfficial: "desc" }, { updatedAt: "desc" }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { renders: true } },
    },
  });
  return NextResponse.json({
    themes: themes.map((t) => ({
      id: t.id,
      name: t.name,
      isOfficial: t.isOfficial,
      isSystem: t.userId === null,
      owner: t.user
        ? { id: t.user.id, name: t.user.name, email: t.user.email }
        : null,
      fontFamily: t.fontFamily,
      tokens: t.tokens,
      renderCount: t._count.renders,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
    })),
  });
}

// Admin-created themes: official by default, owned by the admin who
// created them (so the editor history shows who added it).
export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const tokens = parseTokens(parsed.data.css);
  const theme = await prisma.theme.create({
    data: {
      name: parsed.data.name,
      css: parsed.data.css,
      tokens: tokens as object,
      fontFamily: extractFontFamily(tokens),
      userId: admin.id,
      isOfficial: parsed.data.isOfficial ?? true,
    },
  });
  return NextResponse.json({ theme });
}
