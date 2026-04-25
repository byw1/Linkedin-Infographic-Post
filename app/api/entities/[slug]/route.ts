export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug-utils";
import { refreshUrl } from "@/lib/storage";

const PatchBody = z.object({
  display_name: z.string().trim().min(1).max(120).optional(),
  type: z
    .enum(["company", "person", "brand", "team", "product", "org", "other"])
    .optional(),
  shape: z.enum(["square", "circle", "auto"]).optional(),
});

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const slug = normalizeSlug(params.slug);
  const entity = await prisma.entity.findUnique({
    where: { userId_slug: { userId: user.id, slug } },
  });
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const logoUrl = (await refreshUrl(entity.logoUrl)) ?? entity.logoUrl;
  return NextResponse.json({ entity: { ...entity, logoUrl } });
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const slug = normalizeSlug(params.slug);
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (parsed.data.display_name !== undefined) data.displayName = parsed.data.display_name;
  if (parsed.data.type) data.type = parsed.data.type;
  if (parsed.data.shape) data.shapePreference = parsed.data.shape;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  try {
    const entity = await prisma.entity.update({
      where: { userId_slug: { userId: user.id, slug } },
      data,
    });
    return NextResponse.json({ entity });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const slug = normalizeSlug(params.slug);
  try {
    await prisma.entity.delete({
      where: { userId_slug: { userId: user.id, slug } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
