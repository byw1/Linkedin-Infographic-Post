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

// Whether the user explicitly set S3_PUBLIC_URL. If they did, the bucket is
// reachable directly from browsers (CDN or public bucket) and we serve direct
// URLs. If not, we proxy browser reads through /api/files and presign for
// worker reads.
function publicUrlIsExplicit(): boolean {
  return Boolean(process.env.S3_PUBLIC_URL);
}

function pathStyleUrl(s: StorageSettings, key: string): string {
  return `${s.publicUrl.replace(/\/$/, "")}/${key}`;
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

  // We always store the path-style URL so we can recover the key later.
  return pathStyleUrl(s, key);
}

// Browser-bound URL: what we hand to <img src="...">. Defaults to a relative
// path served by /api/files/[...key], which authenticates and streams from
// the bucket. Skip the proxy and use the direct URL when the user has
// configured a public-readable bucket via S3_PUBLIC_URL.
export function getBrowserUrl(key: string): string {
  if (publicUrlIsExplicit() && process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
  return `/api/files/${key}`;
}

// Server-bound URL: what we hand to puppeteer in the worker. The worker
// container is on Railway's private network and can reach the bucket
// endpoint directly, so a presigned URL works. Public URL takes precedence
// when configured.
export async function getServerUrl(key: string): Promise<string> {
  const s = await getStorageOrThrow();
  if (publicUrlIsExplicit()) {
    return pathStyleUrl(s, key);
  }
  const client = buildClient(s);
  const command = new GetObjectCommand({ Bucket: s.bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

// Recover the object key from a URL we previously generated. Handles:
//   - the path-style ${endpoint}/${bucket}/${key} prefix (what's in the DB)
//   - the explicit S3_PUBLIC_URL prefix (CDN case)
//   - our /api/files/${key} proxy path (what the browser uses)
// Strips any query string.
export function extractKeyFromUrl(url: string, s: StorageSettings): string | null {
  const clean = url.split("?")[0];
  if (clean.startsWith("/api/files/")) {
    return clean.slice("/api/files/".length);
  }
  const candidates = [
    `${s.endpoint.replace(/\/$/, "")}/${s.bucket}/`,
    `${s.publicUrl.replace(/\/$/, "")}/`,
  ];
  for (const prefix of candidates) {
    if (clean.startsWith(prefix)) return clean.slice(prefix.length);
  }
  return null;
}

// Convert a stored URL into a browser-loadable URL. Falls back to the input
// if we can't recover a key (e.g., legacy data or unknown prefix).
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

// Convert a stored URL into a server-loadable URL (for the render worker).
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

// Back-compat alias. Existing callers that previously called refreshUrl()
// were all browser-bound; keep the name working.
export const refreshUrl = refreshBrowserUrl;

export async function isStorageConfigured(): Promise<boolean> {
  const { storage } = await getSettings();
  return storage !== null;
}
