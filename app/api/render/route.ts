export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRenderQueue } from "@/lib/queue";
import { isStorageConfigured, StorageNotConfiguredError } from "@/lib/storage";

const Body = z.object({
  html: z.string().min(1).max(2_000_000),
  mapping: z.record(z.string().url()),
  filename: z.string().max(120).optional(),
  width: z.number().int().min(320).max(2000).optional(),
});

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  if (!(await isStorageConfigured())) {
    return NextResponse.json(
      { error: new StorageNotConfiguredError().message },
      { status: 503 },
    );
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const slugs = Object.keys(parsed.data.mapping);
  const entityCount = slugs.length;

  const render = await prisma.render.create({
    data: {
      userId: user.id,
      filename: parsed.data.filename ?? null,
      entityCount,
      unknownCount: 0,
      status: "pending",
    },
  });

  await getRenderQueue().add(
    "render",
    {
      renderId: render.id,
      userId: user.id,
      html: parsed.data.html,
      mapping: parsed.data.mapping,
      width: parsed.data.width,
    },
    { jobId: render.id },
  );

  // Bump usage counters for resolved entities. Best-effort.
  if (slugs.length > 0) {
    await prisma.entity.updateMany({
      where: { userId: user.id, slug: { in: slugs } },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  }

  return NextResponse.json({ render_id: render.id, status: "pending" });
}
