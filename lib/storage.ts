import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSettings, type StorageSettings } from "@/lib/settings";

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Storage is not configured. Set AWS_* (or S3_*) env vars on the web and worker services.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days, the SigV4 max

async function getStorageOrThrow(): Promise<StorageSettings> {
  const { storage } = await getSettings();
  if (!storage) throw new StorageNotConfiguredError();
  return storage;
}

function buildClient(s: StorageSettings): S3Client {
  return new S3Client({
    region: s.region,
    endpoint: s.endpoint,
    forcePathStyle: s.forcePathStyle,
    credentials: {
      accessKeyId: s.accessKey,
      secretAccessKey: s.secretKey,
    },
  });
}

// S3_PUBLIC_URL is only honored when it parses as a real http(s) URL. This
// guards against placeholder strings like "<see note below>" or "???" that
// people sometimes paste from docs into Railway env vars.
function explicitPublicUrl(): string | null {
  const v = process.env.S3_PUBLIC_URL;
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return v.replace(/\/$/, "");
  } catch {
    return null;
  }
}

// What we put in the DB. Always uses endpoint+bucket so extractKeyFromUrl
// can always recover the key, regardless of how S3_PUBLIC_URL is configured.
function canonicalStoredUrl(s: StorageSettings, key: string): string {
  return `${s.endpoint.replace(/\/$/, "")}/${s.bucket}/${key}`;
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const s = await getStorageOrThrow();
  const client = buildClient(s);

  await client.send(
    new PutObjectCommand({
      Bucket: s.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return canonicalStoredUrl(s, key);
}

// Browser-bound URL: what we hand to <img src="...">. Defaults to the
// /api/files proxy, which always works regardless of bucket access. Skips
// the proxy when S3_PUBLIC_URL is a valid http(s) URL (CDN / public bucket).
export function getBrowserUrl(key: string): string {
  const explicit = explicitPublicUrl();
  if (explicit) return `${explicit}/${key}`;
  return `/api/files/${key}`;
}

// Server-bound URL: what we hand to puppeteer in the worker. Worker is on
// Railway's private network and can reach the bucket directly, so a
// presigned URL works. Public URL takes precedence when configured.
export async function getServerUrl(key: string): Promise<string> {
  const explicit = explicitPublicUrl();
  if (explicit) return `${explicit}/${key}`;
  const s = await getStorageOrThrow();
  const client = buildClient(s);
  const command = new GetObjectCommand({ Bucket: s.bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

// Recover the object key from a URL we previously generated. Tries, in order:
//   1. The /api/files/<key> proxy path (what the browser sends back).
//   2. An explicit, valid S3_PUBLIC_URL prefix.
//   3. The endpoint+bucket prefix (current canonical form).
//   4. A regex fallback for legacy URLs stored when S3_PUBLIC_URL was bogus
//      — looks for the last "/(logos|renders)/<rest>" tail.
export function extractKeyFromUrl(url: string, s: StorageSettings): string | null {
  const clean = url.split("?")[0];

  if (clean.startsWith("/api/files/")) {
    return clean.slice("/api/files/".length);
  }

  const explicit = explicitPublicUrl();
  if (explicit && clean.startsWith(`${explicit}/`)) {
    return clean.slice(`${explicit}/`.length);
  }

  const endpointPrefix = `${s.endpoint.replace(/\/$/, "")}/${s.bucket}/`;
  if (clean.startsWith(endpointPrefix)) return clean.slice(endpointPrefix.length);

  const tail = clean.match(/((?:logos|renders)\/[^?#]+)$/);
  if (tail) return tail[1];

  return null;
}

export async function refreshBrowserUrl(
  storedUrl: string | null | undefined,
): Promise<string | null> {
  if (!storedUrl) return null;
  try {
    const s = await getStorageOrThrow();
    const key = extractKeyFromUrl(storedUrl, s);
    if (!key) return storedUrl;
    return getBrowserUrl(key);
  } catch {
    return storedUrl;
  }
}

export async function refreshServerUrl(
  storedUrl: string | null | undefined,
): Promise<string | null> {
  if (!storedUrl) return null;
  try {
    const s = await getStorageOrThrow();
    const key = extractKeyFromUrl(storedUrl, s);
    if (!key) return storedUrl;
    return await getServerUrl(key);
  } catch {
    return storedUrl;
  }
}

export const refreshUrl = refreshBrowserUrl;

export async function isStorageConfigured(): Promise<boolean> {
  const { storage } = await getSettings();
  return storage !== null;
}
