export const dynamic = "force-dynamic";

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

// Streams an object out of the configured S3-compatible bucket through the
// web service, so the browser doesn't need direct access to the bucket
// endpoint (Railway's Bucket service is private-network only).
//
// Authorization: per-user prefix check. Object keys must start with one of
// "logos/<userId>/" or "renders/<userId>/" to be served. This means the
// stored URL pattern is itself the access-control surface — keep that in
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
  const allowedPrefixes = [`logos/${user.id}/`, `renders/${user.id}/`];
  if (!allowedPrefixes.some((p) => key.startsWith(p))) {
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
    if (!body) return new Response("Not found", { status: 404 });

    const headers: Record<string, string> = {
      "Content-Type": result.ContentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
    };
    if (typeof result.ContentLength === "number") {
      headers["Content-Length"] = String(result.ContentLength);
    }

    return new Response((body as { transformToWebStream: () => ReadableStream }).transformToWebStream(), {
      headers,
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
