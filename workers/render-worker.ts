import { Worker } from "bullmq";
import { htmlToPng } from "@/lib/exporter";
import { uploadFile } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { replaceEntities } from "@/lib/replacer";
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
      const finalHtml = replaceEntities(html, mapping);
      const png = await htmlToPng(finalHtml, width ?? 720);

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
