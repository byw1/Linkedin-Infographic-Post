export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { isStorageConfigured } from "@/lib/storage";
import { getRenderQueue } from "@/lib/queue";

interface Check {
  name: string;
  status: "ok" | "down" | "warn";
  detail?: string;
  meta?: Record<string, unknown>;
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const checks: Check[] = [];

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: "database", status: "ok" });
  } catch (err) {
    checks.push({
      name: "database",
      status: "down",
      detail: (err as Error).message,
    });
  }

  // Redis (sessions, parse cache, rate limiting, render queue)
  try {
    const pong = await getRedis().ping();
    checks.push({ name: "redis", status: pong === "PONG" ? "ok" : "warn", detail: pong });
  } catch (err) {
    checks.push({
      name: "redis",
      status: "down",
      detail: (err as Error).message,
    });
  }

  // Storage
  if (await isStorageConfigured()) {
    checks.push({ name: "storage", status: "ok" });
  } else {
    checks.push({
      name: "storage",
      status: "warn",
      detail: "S3_* env vars not set on this service. PNG export disabled.",
    });
  }

  // Render worker (consumes the BullMQ queue for carousel PDF jobs).
  // Single-image renders happen in the browser and don't need the
  // worker, but the carousel flow does.
  try {
    const queue = getRenderQueue();
    const counts = await queue.getJobCounts(
      "active",
      "waiting",
      "delayed",
      "completed",
      "failed",
    );
    const workers = await queue.getWorkers();
    const workerInfo = workers.map((w) => ({
      name: w.name ?? "unnamed",
      addr: w.addr ?? "unknown",
      idle: w.idle ?? null,
    }));
    checks.push({
      name: "worker",
      status: workers.length > 0 ? "ok" : "warn",
      detail:
        workers.length > 0
          ? `${workers.length} worker(s) connected`
          : "No worker process is consuming the queue. Carousel PDFs won't render. Deploy the worker service in Railway (Dockerfile.worker) and confirm REDIS_URL matches the web service's value.",
      meta: {
        workers: workers.length,
        ...counts,
        ...(workerInfo.length > 0 ? { connected: workerInfo } : {}),
      },
    });
  } catch (err) {
    checks.push({
      name: "worker",
      status: "down",
      detail: (err as Error).message,
    });
  }

  return NextResponse.json({ checks, generated_at: new Date().toISOString() });
}
