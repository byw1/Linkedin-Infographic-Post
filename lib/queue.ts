import { Queue } from "bullmq";
import { getRedis } from "@/lib/redis";

export interface CarouselSlideJob {
  filename: string;
  html: string;
}

export interface RenderJob {
  renderId: string;
  userId: string;
  slides: CarouselSlideJob[];
  mapping: Record<string, string>;
  // Final PDF page size in pixel units. Defaults to 1080×1080 (LinkedIn
  // square carousel) when omitted.
  width?: number;
  height?: number;
}

export const RENDER_QUEUE_NAME = "renders";

let queue: Queue<RenderJob> | null = null;

export function getRenderQueue(): Queue<RenderJob> {
  if (queue) return queue;
  queue = new Queue<RenderJob>(RENDER_QUEUE_NAME, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
  return queue;
}
