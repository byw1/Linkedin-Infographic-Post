import { Queue } from "bullmq";
import { getRedis } from "@/lib/redis";

export interface RenderJob {
  renderId: string;
  userId: string;
  html: string;
  mapping: Record<string, string>;
  width?: number;
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

export const renderQueue = new Proxy({} as Queue<RenderJob>, {
  get(_target, prop) {
    const q = getRenderQueue();
    const value = (q as unknown as Record<string | symbol, unknown>)[prop as string];
    return typeof value === "function" ? (value as Function).bind(q) : value;
  },
});
