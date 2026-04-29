export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  extractFontFamily,
  listThemesForUser,
  parseTokens,
} from "@/lib/themes";

const MAX_CSS_BYTES = 64 * 1024; // 64 KB — generous for any token block

const CreateBody = z.object({
  name: z.string().trim().min(1).max(80),
  css: z.string().trim().min(1).max(MAX_CSS_BYTES),
});

// List themes the caller can pick from. Officials + the caller's own.
// Admins use /api/admin/themes for the global view.
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const themes = await listThemesForUser(user.id);
  return NextResponse.json({
    themes: themes.map((t) => ({
      id: t.id,
      name: t.name,
      isOfficial: t.isOfficial,
      isMine: t.userId === user.id,
      fontFamily: t.fontFamily,
      tokens: t.tokens,
      updatedAt: t.updatedAt,
    })),
  });
}

// Members create themes for their own use. Admins can also create
// here — promotion to "official" happens via /api/admin/themes/[id]
// (separate concern from authoring).
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const tokens = parseTokens(parsed.data.css);
  const fontFamily = extractFontFamily(tokens);
  const theme = await prisma.theme.create({
    data: {
      name: parsed.data.name,
      css: parsed.data.css,
      tokens: tokens as object,
      fontFamily,
      userId: user.id,
      isOfficial: false,
    },
  });
  return NextResponse.json({ theme });
}
