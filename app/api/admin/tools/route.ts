export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(500),
  description: z.string().trim().max(2000).optional().nullable(),
  // Tags: lowercase + hyphenated like the rest of the app's tag
  // surfaces. Trim, drop empties, dedupe.
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(40))
    .max(20)
    .optional(),
  logoUrl: z.string().trim().url().max(500).optional().nullable(),
  position: z.number().int().min(0).max(10_000).optional(),
});

// Admin: list everything (same as public for now, but keeps the
// surface separate so we can add admin-only fields later).
export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const tools = await prisma.tool.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ tools });
}

// Admin: create. New tools default to position = (max + 1) so they
// land at the end of the list.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { tags, ...rest } = parsed.data;

  const last = await prisma.tool.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = parsed.data.position ?? (last ? last.position + 1 : 0);

  const tool = await prisma.tool.create({
    data: {
      name: rest.name,
      url: rest.url,
      description: rest.description ?? null,
      logoUrl: rest.logoUrl ?? null,
      tags: dedupeTags(tags ?? []),
      position,
    },
  });
  return NextResponse.json({ tool });
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
