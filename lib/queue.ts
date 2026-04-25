import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export interface RenderJob {
  renderId: string;
  userId: string;
  html: string;
  mapping: Record<string, string>;
  width?: number;
}

export const RENDER_QUEUE_NAME = "renders";

export const renderQueue = new Queue<RenderJob>(RENDER_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});
