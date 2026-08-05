// One-off bucket-to-bucket copy, for moving object storage between Railway
// workspaces (Railway won't transfer a bucket with a project, so the objects
// have to be copied out and back in by hand).
//
// Reads two sets of credentials from the environment:
//
//   SRC_ENDPOINT  SRC_BUCKET  SRC_ACCESS_KEY_ID  SRC_SECRET_ACCESS_KEY  SRC_REGION
//   DST_ENDPOINT  DST_BUCKET  DST_ACCESS_KEY_ID  DST_SECRET_ACCESS_KEY  DST_REGION
//
// Region defaults to "auto" (what Railway buckets use). Set DRY_RUN=1 to list
// what would be copied without writing anything.
//
// Safe to re-run: an object already in the destination at the same byte size
// is skipped, so an interrupted run resumes where it left off. Nothing is ever
// deleted from the source — deleting the old bucket stays a manual step you
// take only after the verify at the end reports a clean match.

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const CONCURRENCY = 8;
const DRY_RUN = process.env.DRY_RUN === "1";

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function clientFor(prefix) {
  return {
    client: new S3Client({
      endpoint: required(`${prefix}_ENDPOINT`),
      region: process.env[`${prefix}_REGION`] || "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: required(`${prefix}_ACCESS_KEY_ID`),
        secretAccessKey: required(`${prefix}_SECRET_ACCESS_KEY`),
      },
    }),
    bucket: required(`${prefix}_BUCKET`),
  };
}

async function listAll({ client, bucket }) {
  const out = [];
  let token;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) out.push({ key: o.Key, size: o.Size });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

// Already there at the same size? Treat as done. Size is a weak checksum, but
// these are content-addressed keys (name includes a fingerprint) so a
// same-key-same-size collision with different bytes isn't a real case here.
async function alreadyCopied(dst, key, size) {
  try {
    const head = await dst.client.send(
      new HeadObjectCommand({ Bucket: dst.bucket, Key: key }),
    );
    return head.ContentLength === size;
  } catch {
    return false;
  }
}

async function copyOne(src, dst, { key, size }) {
  if (await alreadyCopied(dst, key, size)) return "skipped";
  if (DRY_RUN) return "would-copy";

  const res = await src.client.send(
    new GetObjectCommand({ Bucket: src.bucket, Key: key }),
  );
  // Objects here are images and small markdown files, so buffering whole is
  // fine and avoids stream-length quirks across S3-compatible endpoints.
  const body = Buffer.from(await res.Body.transformToByteArray());

  await dst.client.send(
    new PutObjectCommand({
      Bucket: dst.bucket,
      Key: key,
      Body: body,
      ContentType: res.ContentType ?? "application/octet-stream",
      CacheControl: res.CacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
  return "copied";
}

// Fixed-size worker pool. Keeps a slow object from stalling the whole run
// without hammering the endpoint with hundreds of parallel requests.
async function runPool(items, worker) {
  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

async function main() {
  const src = clientFor("SRC");
  const dst = clientFor("DST");

  console.log(`Source:      ${src.bucket}`);
  console.log(`Destination: ${dst.bucket}`);
  if (DRY_RUN) console.log("DRY_RUN=1 — nothing will be written.\n");

  const objects = await listAll(src);
  const totalBytes = objects.reduce((n, o) => n + o.size, 0);
  console.log(`Found ${objects.length} objects, ${mb(totalBytes)} MB\n`);

  if (objects.length === 0) {
    console.log("Source bucket is empty — nothing to do.");
    return;
  }

  const tally = { copied: 0, skipped: 0, "would-copy": 0 };
  const failures = [];
  let done = 0;

  await runPool(objects, async (obj) => {
    try {
      tally[await copyOne(src, dst, obj)]++;
    } catch (err) {
      failures.push({ key: obj.key, message: err?.message ?? String(err) });
    }
    if (++done % 25 === 0 || done === objects.length) {
      console.log(`  ${done}/${objects.length}`);
    }
  });

  console.log(
    `\ncopied ${tally.copied}, skipped ${tally.skipped}` +
      (DRY_RUN ? `, would copy ${tally["would-copy"]}` : "") +
      `, failed ${failures.length}`,
  );

  for (const f of failures) console.error(`  FAILED ${f.key}: ${f.message}`);

  if (DRY_RUN) return;

  // Verify by re-listing the destination rather than trusting our own tally.
  const after = await listAll(dst);
  const dstSizes = new Map(after.map((o) => [o.key, o.size]));
  const missing = objects.filter((o) => dstSizes.get(o.key) !== o.size);

  console.log(
    `\nVerify: source ${objects.length} objects / ${mb(totalBytes)} MB` +
      ` → destination ${after.length} objects /` +
      ` ${mb(after.reduce((n, o) => n + o.size, 0))} MB`,
  );

  if (missing.length > 0 || failures.length > 0) {
    console.error(`\nINCOMPLETE — ${missing.length} objects missing or wrong size.`);
    for (const m of missing.slice(0, 20)) console.error(`  ${m.key}`);
    if (missing.length > 20) console.error(`  ...and ${missing.length - 20} more`);
    console.error("\nDo NOT delete the source bucket. Re-run to retry the gaps.");
    process.exit(1);
  }

  console.log("\nOK — every source object is present in the destination.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
