import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

// @upstash/ratelimit accepts both Upstash and ioredis-compatible clients.
// The TS types are tied to Upstash's client, so we cast to satisfy the constructor.
export const exportRateLimit = redis
  ? new Ratelimit({
      redis: redis as unknown as ConstructorParameters<typeof Ratelimit>[0]["redis"],
      limiter: Ratelimit.slidingWindow(50, "1 h"),
      analytics: false,
      prefix: "rl:export",
    })
  : null;
