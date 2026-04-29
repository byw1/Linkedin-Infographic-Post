import { Worker } from "bullmq";
import { htmlSlidesToOutput } from "@/lib/carousel-exporter";
import { getBrowserUrl, uploadFile } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { RENDER_QUEUE_NAME, type RenderJob } from "@/lib/queue";

// Drains the BullMQ queue. Each job is a server-side carousel PDF
// render: take N slide HTMLs + a global mapping, run each through
// puppeteer's page.pdf() so the PDF text stays text (sharper on
// LinkedIn, smaller files, copy-able), merge into one PDF, upload to
// S3, and stamp the URL back onto the renders row.
const worker = new Worker<RenderJob>(
  RENDER_QUEUE_NAME,
  async (job) => {
    const { renderId, userId, slides, mapping, format, width, height, themeCss } =
      job.data;
    const outputFormat = format ?? "pdf";

    await prisma.render.update({
      where: { id: renderId },
      data: { status: "rendering" },
    });

    try {
      const result = await htmlSlidesToOutput(slides, mapping, outputFormat, {
        width,
        height,
        themeCss,
        // Stream progress into the BullMQ job so future polling can
        // surface "rendering 3 of 8" if we want to.
        onSlide: async (current, total) => {
          await job.updateProgress({ current, total });
        },
      });

      const key = `renders/${userId}/${renderId}.${result.extension}`;
      await uploadFile(key, result.buffer, result.contentType);
      const publicUrl = getBrowserUrl(key);

      await prisma.render.update({
        where: { id: renderId },
        data: {
          status: "complete",
          pngUrl: publicUrl,
          completedAt: new Date(),
        },
      });

      return { url: publicUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      console.error(
        `[render-worker] render ${renderId} (user ${userId}) failed: ${message}`,
        stack ?? "",
      );
      await prisma.render.update({
        where: { id: renderId },
        data: { status: "failed", errorMessage: message },
      });
      throw error;
    }
  },
  {
    connection: getRedis(),
    concurrency: Number(process.env.RENDER_CONCURRENCY ?? 2),
  },
);

worker.on("completed", (job) => {
  console.log(`[render-worker] job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[render-worker] job ${job?.id} failed:`, err);
});

console.log("[render-worker] started");
