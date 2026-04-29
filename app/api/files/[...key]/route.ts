export const dynamic = "force-dynamic";

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

// Streams an object out of the configured S3-compatible bucket through the
// web service, so the browser doesn't need direct access to the bucket
// endpoint (Railway's Bucket service is private-network only).
//
// Authorization is prefix-based:
// - "logos/<userId>/", "renders/<userId>/": only the owning user can fetch.
// - "skills/": team-shared, any signed-in user can fetch.
// The stored URL pattern is itself the access-control surface — keep that in
// mind if you ever change the upload key shape.
export async function GET(
  _req: Request,
  { params }: { params: { key: string[] } },
): Promise<Response> {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const key = params.key.map(decodeURIComponent).join("/");
  const ownPrefixes = [`logos/${user.id}/`, `renders/${user.id}/`];
  const sharedPrefixes = ["skills/"];
  const allowed =
    ownPrefixes.some((p) => key.startsWith(p)) ||
    sharedPrefixes.some((p) => key.startsWith(p));
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const { storage } = await getSettings();
  if (!storage) {
    return new Response("Storage not configured", { status: 503 });
  }

  const client = new S3Client({
    region: storage.region,
    endpoint: storage.endpoint,
    forcePathStyle: storage.forcePathStyle,
    credentials: {
      accessKeyId: storage.accessKey,
      secretAccessKey: storage.secretKey,
    },
  });

  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: storage.bucket, Key: key }),
    );
    const body = result.Body;
    if (!body) {
      console.error(`[files] ${key}: GetObject returned empty body`);
      return new Response("Not found", { status: 404 });
    }

    // SDK Body in Node.js is a Readable. Buffer it (logos are <100KB,
    // renders ~1-2MB) — simpler than wrestling with stream conversion
    // across runtimes, and avoids transformToWebStream shape issues.
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const headers: Record<string, string> = {
      "Content-Type": result.ContentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "Content-Length": String(buffer.byteLength),
    };

    return new Response(buffer, { headers });
  } catch (err) {
    console.error(`[files] ${key}: GetObject failed`, err);
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status === 404 || (err as { name?: string }).name === "NoSuchKey") {
      return new Response("Not found", { status: 404 });
    }
    return new Response(`Storage error: ${(err as Error).message}`, { status: 502 });
  }
}
