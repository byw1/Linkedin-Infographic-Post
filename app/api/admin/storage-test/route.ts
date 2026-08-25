export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

interface StepResult {
  step: string;
  ok: boolean;
  detail?: string;
  ms?: number;
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return url;
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export async function POST() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { storage } = await getSettings();
  if (!storage) {
    return NextResponse.json(
      {
        ok: false,
        config: null,
        steps: [],
        error: "Storage is not configured (no AWS_*/S3_* env vars).",
      },
      { status: 503 },
    );
  }

  const rawPublicUrl = process.env.S3_PUBLIC_URL;
  let publicUrlMode = "auto (proxied via /api/files)";
  if (rawPublicUrl) {
    try {
      const u = new URL(rawPublicUrl);
      if (u.protocol === "http:" || u.protocol === "https:") {
        publicUrlMode = `explicit: ${rawPublicUrl}`;
      } else {
        publicUrlMode = `INVALID (${rawPublicUrl}) — ignored, proxying via /api/files`;
      }
    } catch {
      publicUrlMode = `INVALID (${rawPublicUrl}) — ignored, proxying via /api/files`;
    }
  }

  const config = {
    endpoint: maskUrl(storage.endpoint),
    region: storage.region,
    bucket: storage.bucket,
    forcePathStyle: storage.forcePathStyle,
    publicUrlMode,
    accessKey: maskKey(storage.accessKey),
  };

  const client = new S3Client({
    region: storage.region,
    endpoint: storage.endpoint,
    forcePathStyle: storage.forcePathStyle,
    credentials: {
      accessKeyId: storage.accessKey,
      secretAccessKey: storage.secretKey,
    },
  });

  const steps: StepResult[] = [];
  const probeKey = `_health/${admin.id}/${crypto.randomBytes(4).toString("hex")}.txt`;
  const probeBytes = Buffer.from(`Viral storage test @ ${new Date().toISOString()}`);

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    const started = Date.now();
    try {
      const result = await fn();
      steps.push({ step: label, ok: true, ms: Date.now() - started });
      return result;
    } catch (err) {
      const detail = describeAwsError(err);
      steps.push({ step: label, ok: false, ms: Date.now() - started, detail });
      console.error(`[storage-test] ${label} failed`, err);
      return null;
    }
  }

  await run("HeadBucket (auth + bucket exists)", () =>
    client.send(new HeadBucketCommand({ Bucket: storage.bucket })),
  );

  const putOk = await run("PutObject (write)", () =>
    client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: probeKey,
        Body: probeBytes,
        ContentType: "text/plain",
      }),
    ),
  );

  if (putOk) {
    const got = await run("GetObject (read back)", async () => {
      const result = await client.send(
        new GetObjectCommand({ Bucket: storage.bucket, Key: probeKey }),
      );
      const chunks: Uint8Array[] = [];
      for await (const chunk of result.Body as unknown as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buf = Buffer.concat(chunks);
      if (!buf.equals(probeBytes)) throw new Error("Read bytes don't match what was written.");
      return true;
    });
    if (got) {
      await run("DeleteObject (cleanup)", () =>
        client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: probeKey })),
      );
    }
  }

  const ok = steps.every((s) => s.ok);
  return NextResponse.json({ ok, config, steps, probeKey });
}

function describeAwsError(err: unknown): string {
  const e = err as {
    name?: string;
    message?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
    $fault?: string;
  };
  const parts: string[] = [];
  if (e.name && e.name !== "Error") parts.push(e.name);
  if (e.Code && e.Code !== e.name) parts.push(e.Code);
  if (e.$metadata?.httpStatusCode) parts.push(`HTTP ${e.$metadata.httpStatusCode}`);
  parts.push(e.message ?? String(err));
  return parts.join(" · ");
}
