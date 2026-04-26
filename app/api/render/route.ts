export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRenderQueue } from "@/lib/queue";
import { isStorageConfigured, refreshServerUrl, StorageNotConfiguredError } from "@/lib/storage";

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

  // No point queueing if no worker is around to pick it up — the job would
  // sit in the queue or fail opaquely. Tell the user up front.
  try {
    const workers = await getRenderQueue().getWorkersCount();
    if (workers === 0) {
      return NextResponse.json(
        {
          error:
            "No render worker is connected. Deploy the worker service in Railway (Dockerfile.worker) — see /admin → Health.",
        },
        { status: 503 },
      );
    }
  } catch {
    // If we can't reach Redis to count workers, fall through and let the
    // queue.add call surface the real error.
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const slugs = Object.keys(parsed.data.mapping);
  const entityCount = slugs.length;

  // The mapping the browser gave us has /api/files/... proxy URLs (which
  // require a session cookie). The worker can't use those — it's on the
  // private network and authenticates differently. Convert each to a
  // presigned S3 URL the worker's puppeteer can fetch directly.
  const freshMapping: Record<string, string> = {};
  for (const [slug, url] of Object.entries(parsed.data.mapping)) {
    freshMapping[slug] = (await refreshServerUrl(url)) ?? url;
  }

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
      mapping: freshMapping,
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
