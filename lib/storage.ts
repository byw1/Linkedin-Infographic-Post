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

// Whether the user explicitly set S3_PUBLIC_URL. If they did, we trust their
// CDN/public-bucket setup and serve direct URLs. If not, we presign so private
// buckets (Railway Bucket, default MinIO) work without extra config.
function publicUrlIsExplicit(): boolean {
  return Boolean(process.env.S3_PUBLIC_URL);
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

  return getReadUrlSync(s, key);
}

function getReadUrlSync(s: StorageSettings, key: string): string {
  // Always returns the path-style URL. Caller decides whether to presign via
  // getReadUrl() (async) when needed.
  const base = s.publicUrl.replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function getReadUrl(key: string): Promise<string> {
  const s = await getStorageOrThrow();
  if (publicUrlIsExplicit()) {
    return getReadUrlSync(s, key);
  }
  const client = buildClient(s);
  const command = new GetObjectCommand({ Bucket: s.bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

// Given a URL we previously generated and stored in the DB, recover the
// underlying object key. Works for both ${endpoint}/${bucket}/${key} (the
// auto-derived public URL) and ${S3_PUBLIC_URL}/${key} (explicit CDN). Falls
// back to null if the URL doesn't match a known prefix.
export function extractKeyFromUrl(url: string, s: StorageSettings): string | null {
  // Strip any query string (e.g., presign params from a previous round).
  const clean = url.split("?")[0];

  const candidates = [
    `${s.endpoint.replace(/\/$/, "")}/${s.bucket}/`,
    `${s.publicUrl.replace(/\/$/, "")}/`,
  ];
  for (const prefix of candidates) {
    if (clean.startsWith(prefix)) return clean.slice(prefix.length);
  }
  return null;
}

// Convert a stored URL (which may or may not be browser-loadable depending on
// bucket access) into a freshly-signed URL. If we can't recover the key, we
// return the input unchanged so the caller still gets *something*.
export async function refreshUrl(storedUrl: string | null | undefined): Promise<string | null> {
  if (!storedUrl) return null;
  try {
    const s = await getStorageOrThrow();
    if (publicUrlIsExplicit()) return storedUrl;
    const key = extractKeyFromUrl(storedUrl, s);
    if (!key) return storedUrl;
    return await getReadUrl(key);
  } catch {
    return storedUrl;
  }
}

export async function isStorageConfigured(): Promise<boolean> {
  const { storage } = await getSettings();
  return storage !== null;
}
