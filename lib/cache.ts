import { redis } from "@/lib/redis";

const PARSE_TTL_SECONDS = 60 * 60;

export async function getCachedParse<T>(htmlHash: string): Promise<T | null> {
  if (!redis) return null;
  const cached = await redis.get(`parse:${htmlHash}`);
  return cached ? (JSON.parse(cached) as T) : null;
}

export async function cacheParse<T>(htmlHash: string, value: T): Promise<void> {
  if (!redis) return;
  await redis.setex(`parse:${htmlHash}`, PARSE_TTL_SECONDS, JSON.stringify(value));
}
