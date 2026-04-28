export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { isStorageConfigured } from "@/lib/storage";

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

  // Redis (sessions, parse cache, rate limiting)
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

  return NextResponse.json({ checks, generated_at: new Date().toISOString() });
}
