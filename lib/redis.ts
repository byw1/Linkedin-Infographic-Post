import IORedis, { type RedisOptions } from "ioredis";

const globalForRedis = globalThis as unknown as { redis: IORedis | undefined };

const url = process.env.REDIS_URL;
if (!url && process.env.NODE_ENV === "production") {
  throw new Error("REDIS_URL is required in production");
}

const options: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
};

export const redis =
  globalForRedis.redis ?? (url ? new IORedis(url, options) : (undefined as unknown as IORedis));

if (process.env.NODE_ENV !== "production" && url) globalForRedis.redis = redis;
