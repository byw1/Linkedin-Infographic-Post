export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStorageConfigured, refreshServerUrl, StorageNotConfiguredError } from "@/lib/storage";
import { getRenderQueue } from "@/lib/queue";
import { buildStyleCss } from "@/lib/themes";

// Mapping value can be either an absolute URL (CDN / public bucket via
// S3_PUBLIC_URL) or the /api/files/<key> proxy path that getBrowserUrl
// returns for private buckets. The render route converts whichever
// form it gets into a presigned S3 URL via refreshServerUrl below so
// puppeteer (running on the worker, on Railway's private network) can
// fetch it directly.
const LogoRef = z.string().refine(
  (v) => v.startsWith("/api/files/") || /^https?:\/\//i.test(v),
  { message: "Expected an absolute http(s) URL or an /api/files/<key> path" },
);

const Body = z.object({
  slides: z
    .array(
      z.object({
        filename: z.string().max(200),
        html: z.string().min(1).max(2_000_000),
      }),
    )
    .min(1)
    .max(40),
  mapping: z.record(LogoRef),
  filename: z.string().max(120).optional(),
  // pdf = LinkedIn document carousel (real text PDF). png-zip = one
  // PNG per slide for Instagram or anywhere that doesn't accept PDFs.
  format: z.enum(["pdf", "png-zip"]).default("pdf"),
  width: z.number().int().min(320).max(4000).optional(),
  height: z.number().int().min(320).max(4000).optional(),
  themeId: z.string().uuid().nullish(),
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

  // No worker, no point queueing. Tell the user up front instead of
  // letting the job sit around silently.
  try {
    const workers = await getRenderQueue().getWorkersCount();
    if (workers === 0) {
      return NextResponse.json(
        {
          error:
            "No render worker is connected. Deploy the worker service in Railway (Dockerfile.worker) — see /admin/health.",
        },
        { status: 503 },
      );
    }
  } catch {
    // If we can't reach Redis, fall through and let queue.add surface
    // the actual error.
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Convert each browser-bound mapping URL (cookie-gated /api/files/...)
  // into a presigned S3 URL the worker's puppeteer can fetch directly
  // from the bucket without going through the web service.
  const freshMapping: Record<string, string> = {};
  for (const [slug, url] of Object.entries(parsed.data.mapping)) {
    freshMapping[slug] = (await refreshServerUrl(url)) ?? url;
  }

  // Resolve the theme on the server so the worker can stay DB-free.
  // Bad / unauthorized ids drop silently (render proceeds without a
  // theme), matching how /api/render handles the same input.
  let themeIdToStore: string | null = null;
  let themeCss: string | undefined;
  if (parsed.data.themeId) {
    const theme = await prisma.theme.findUnique({
      where: { id: parsed.data.themeId },
      select: {
        id: true,
        userId: true,
        isOfficial: true,
        css: true,
        tokens: true,
      },
    });
    if (theme && (theme.isOfficial || theme.userId === user.id)) {
      themeIdToStore = theme.id;
      themeCss = buildStyleCss({
        css: theme.css,
        tokens: (theme.tokens ?? {}) as Record<string, string>,
      });
    }
  }

  const slugCount = Object.keys(freshMapping).length;
  const render = await prisma.render.create({
    data: {
      userId: user.id,
      filename: parsed.data.filename ?? null,
      entityCount: slugCount,
      unknownCount: 0,
      status: "pending",
      themeId: themeIdToStore,
      format: "carousel",
      // Persist the slide HTML for the Remix flow — uniform shape
      // with single-post renders so the loader doesn't branch on
      // format. Slides are stored verbatim (with their data-entity
      // placeholders intact); the rendered PDF/PNG is the resolved
      // version, but Remix re-opens the editor with placeholders so
      // the user can swap logos again.
      sourceHtml: {
        slides: parsed.data.slides.map((s) => ({
          filename: s.filename,
          html: s.html,
        })),
      },
    },
  });

  await getRenderQueue().add(
    "render",
    {
      renderId: render.id,
      userId: user.id,
      slides: parsed.data.slides,
      mapping: freshMapping,
      format: parsed.data.format,
      width: parsed.data.width,
      height: parsed.data.height,
      themeCss,
    },
    { jobId: render.id },
  );

  return NextResponse.json({ render_id: render.id, status: "pending" });
}
