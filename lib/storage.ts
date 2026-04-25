import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSettings, type StorageSettings } from "@/lib/settings";

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, and S3_PUBLIC_URL on the web and worker services.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

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

  const publicBase = s.publicUrl.replace(/\/$/, "");
  return `${publicBase}/${key}`;
}

export async function isStorageConfigured(): Promise<boolean> {
  const { storage } = await getSettings();
  return storage !== null;
}
