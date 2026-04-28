import { Worker } from "bullmq";
import { htmlToPng } from "@/lib/exporter";
import { uploadFile } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { RENDER_QUEUE_NAME, type RenderJob } from "@/lib/queue";

const worker = new Worker<RenderJob>(
  RENDER_QUEUE_NAME,
  async (job) => {
    const { renderId, html, mapping, userId, width } = job.data;

    await prisma.render.update({
      where: { id: renderId },
      data: { status: "rendering" },
    });

    try {
      // Pass the original HTML straight through. The exporter does the
      // placeholder→<img> swap in-page so the worker's render matches what
      // the iframe shows in the editor exactly.
      const png = await htmlToPng(html, mapping, width ?? 720);

      const key = `renders/${userId}/${renderId}.png`;
      const url = await uploadFile(key, png, "image/png");

      await prisma.render.update({
        where: { id: renderId },
        data: {
          status: "complete",
          pngUrl: url,
          completedAt: new Date(),
        },
      });

      return { url };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      console.error(
        `[render-worker] render ${renderId} (user ${userId}) failed: ${message}`,
        stack ?? "",
      );
      await prisma.render.update({
        where: { id: renderId },
        data: {
          status: "failed",
          errorMessage: message,
        },
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
