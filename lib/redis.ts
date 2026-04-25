import IORedis, { type RedisOptions } from "ioredis";

const globalForRedis = globalThis as unknown as { redis: IORedis | undefined };

const options: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
  // Railway's private network resolves to IPv6 only. ioredis defaults to
  // IPv4 (family: 4), which produces ECONNREFUSED. family: 0 lets DNS
  // return either, which works on Railway and locally.
  family: 0,
};

export function getRedis(): IORedis {
  if (globalForRedis.redis) return globalForRedis.redis;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  const client = new IORedis(url, options);
  if (process.env.NODE_ENV !== "production") globalForRedis.redis = client;
  return client;
}

// Lazy proxy so importing `redis` doesn't open a connection or throw at
// module load (which Next.js does while collecting page data).
export const redis: IORedis = new Proxy({} as IORedis, {
  get(_target, prop) {
    const client = getRedis();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop as string];
    return typeof value === "function" ? (value as Function).bind(client) : value;
  },
});
