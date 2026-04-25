import { getRedis } from "@/lib/redis";

const PARSE_TTL_SECONDS = 60 * 60;

export async function getCachedParse<T>(htmlHash: string): Promise<T | null> {
  try {
    const cached = await getRedis().get(`parse:${htmlHash}`);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheParse<T>(htmlHash: string, value: T): Promise<void> {
  try {
    await getRedis().setex(`parse:${htmlHash}`, PARSE_TTL_SECONDS, JSON.stringify(value));
  } catch {
    // best-effort cache; ignore
  }
}
