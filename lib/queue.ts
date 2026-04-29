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
  // "pdf" produces a real-text multi-page PDF (LinkedIn document
  // carousels). "png-zip" produces a zip of one PNG per slide
  // (Instagram, anywhere that doesn't take PDFs). Defaults to "pdf"
  // on consumers that don't pass the field.
  format?: "pdf" | "png-zip";
  // Slide page size in pixel units. Defaults to 1080×1350 (4:5
  // portrait) — fits Instagram carousels and LinkedIn documents in
  // one crop.
  width?: number;
  height?: number;
  // Theme CSS to inject into each slide before snapshotting. The
  // raw CSS travels with the job (rather than the theme id) so the
  // worker doesn't need DB access to render — keeps the worker's
  // failure modes independent of Postgres availability.
  themeCss?: string;
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
