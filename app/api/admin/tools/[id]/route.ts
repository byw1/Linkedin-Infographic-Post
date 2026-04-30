export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const Patch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  url: z.string().trim().url().max(500).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(40))
    .max(20)
    .optional(),
  logoUrl: z.string().trim().url().max(500).nullable().optional(),
  position: z.number().int().min(0).max(10_000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.url !== undefined) data.url = parsed.data.url;
  if (parsed.data.description !== undefined) {
    const trimmed = parsed.data.description?.trim();
    data.description = trimmed ? trimmed : null;
  }
  if (parsed.data.logoUrl !== undefined) {
    data.logoUrl = parsed.data.logoUrl ?? null;
  }
  if (parsed.data.tags !== undefined) data.tags = dedupeTags(parsed.data.tags);
  if (parsed.data.position !== undefined) data.position = parsed.data.position;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const tool = await prisma.tool.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ tool });
  } catch {
    return NextResponse.json({ error: "Tool not found." }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  try {
    await prisma.tool.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Tool not found." }, { status: 404 });
  }
}

function dedupeTags(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
