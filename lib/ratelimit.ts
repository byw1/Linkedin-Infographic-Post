import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

let limiter: Ratelimit | null = null;

export function getExportRateLimit(): Ratelimit {
  if (limiter) return limiter;
  limiter = new Ratelimit({
    redis: getRedis() as unknown as ConstructorParameters<typeof Ratelimit>[0]["redis"],
    limiter: Ratelimit.slidingWindow(50, "1 h"),
    analytics: false,
    prefix: "rl:export",
  });
  return limiter;
}
