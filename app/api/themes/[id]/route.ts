export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractFontFamily, parseTokens } from "@/lib/themes";

const MAX_CSS_BYTES = 64 * 1024;

const PatchBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  css: z.string().trim().min(1).max(MAX_CSS_BYTES).optional(),
});

// Edit / delete rules:
//   - System themes (user_id = NULL): only admins.
//   - Official themes owned by another user: only admins (or the
//     owner — admins promoted *their* theme, didn't take it from them).
//   - Private themes: only owner or admin.
async function canEdit(
  theme: { userId: string | null; isOfficial: boolean },
  user: { id: string; role: "user" | "admin" },
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (theme.userId === null) return false;
  return theme.userId === user.id;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const theme = await prisma.theme.findUnique({ where: { id: params.id } });
  if (!theme) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Read access: anyone can read official themes; otherwise owner / admin.
  const canRead =
    theme.isOfficial ||
    user.role === "admin" ||
    theme.userId === user.id;
  if (!canRead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ theme });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const theme = await prisma.theme.findUnique({ where: { id: params.id } });
  if (!theme) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEdit(theme, user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.css !== undefined) {
    const tokens = parseTokens(parsed.data.css);
    data.css = parsed.data.css;
    data.tokens = tokens as object;
    data.fontFamily = extractFontFamily(tokens);
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const updated = await prisma.theme.update({ where: { id: theme.id }, data });
  return NextResponse.json({ theme: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const theme = await prisma.theme.findUnique({ where: { id: params.id } });
  if (!theme) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // System themes can't be deleted via the API — they're seeded and
  // the renderer falls back to them. Admins who really need to remove
  // one should unpublish (is_official = false) via the admin route.
  if (theme.userId === null) {
    return NextResponse.json(
      { error: "System themes can't be deleted. Unpublish from /admin/themes instead." },
      { status: 409 },
    );
  }
  if (!(await canEdit(theme, user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.theme.delete({ where: { id: theme.id } });
  return NextResponse.json({ ok: true });
}
