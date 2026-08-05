# Moving the project to another Railway account

Railway transfers a whole project in one go — services, Postgres and its data,
Redis, and the custom domain. It will **not** transfer a bucket. The transfer
button refuses to start while the project still has one:

> Buckets can't be transferred. This project has 1 bucket. Delete it below to
> transfer the project to a different workspace.

So the objects have to be copied to a new bucket first, and the app pointed at
it, before the old bucket can be deleted and the transfer run.

Nothing here deletes anything until the copy has been verified and the app has
been confirmed working against the new bucket.

## Before you start

- The destination account needs an active **Hobby or Pro** plan. Railway blocks
  transfers into a free workspace.
- The `main` and `worker` services deploy from a **feature branch**, not `main`.
  Check which branch under each service's Settings → Source. The storage fix in
  this branch has to be on that deploy branch before the cutover in step 6,
  otherwise member avatars and tool logos break (see "Why the code changed").

## 1. Make the new bucket

In the **destination** account:

1. Create a new project — call it something like `linkedin-infographic-storage`.
2. Add a **Bucket** to it.
3. Open the bucket's Variables tab and keep it open. You need `ENDPOINT`,
   `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, and `REGION`.

The bucket lives in its own project because it can't be inside the project
being transferred — that's the whole problem. Step 8 covers folding it back in
afterwards if you want everything under one project again.

## 2. Add the temporary copy service

In the **existing** project, add a service from this repo pointed at the
migration branch, with Settings → Config-as-code set to `railway.migrate.json`.
That builds `Dockerfile.migrate`, which skips the Next build and installs only
the S3 client, so it comes up in seconds.

Its restart policy is `NEVER` on purpose. This is a job, not a service — a
restart policy would re-run the copy in a loop.

## 3. Give it both sets of credentials

Source — use Railway's reference syntax so the current bucket's secrets are
never copied anywhere:

```
SRC_ENDPOINT          = ${{Bucket.ENDPOINT}}
SRC_BUCKET            = ${{Bucket.BUCKET}}
SRC_ACCESS_KEY_ID     = ${{Bucket.ACCESS_KEY_ID}}
SRC_SECRET_ACCESS_KEY = ${{Bucket.SECRET_ACCESS_KEY}}
SRC_REGION            = ${{Bucket.REGION}}
```

Destination — paste the five values from step 1. References don't work here;
they only resolve inside one project.

```
DST_ENDPOINT          = <new bucket ENDPOINT>
DST_BUCKET            = <new bucket BUCKET>
DST_ACCESS_KEY_ID     = <new bucket ACCESS_KEY_ID>
DST_SECRET_ACCESS_KEY = <new bucket SECRET_ACCESS_KEY>
DST_REGION            = <new bucket REGION>
```

## 4. Dry run

Set `DRY_RUN=1` and deploy. The logs should report something like:

```
Found 412 objects, 79.8 MB
copied 0, skipped 0, would copy 412, failed 0
```

This writes nothing. It proves the script can read the old bucket and reach the
new one. If the object count looks wrong, stop here.

## 5. Run the copy

Delete `DRY_RUN` and redeploy. The script copies with 8 workers, then re-lists
the destination and compares against the source rather than trusting its own
tally. A clean run ends with:

```
Verify: source 412 objects / 79.8 MB → destination 412 objects / 79.8 MB

OK — every source object is present in the destination.
```

Anything else exits non-zero and tells you not to delete the source. The script
is safe to re-run — objects already present at the same size are skipped, so a
retry only fills gaps.

## 6. Point the app at the new bucket

On **both** `main` and `worker`, replace the `${{Bucket.*}}` references with the
new bucket's literal values:

| Variable | New value |
|---|---|
| `AWS_ENDPOINT_URL`, `S3_ENDPOINT` | new bucket `ENDPOINT` |
| `AWS_S3_BUCKET_NAME`, `S3_BUCKET` | new bucket `BUCKET` |
| `AWS_ACCESS_KEY_ID`, `S3_ACCESS_KEY` | new bucket `ACCESS_KEY_ID` |
| `AWS_SECRET_ACCESS_KEY`, `S3_SECRET_KEY` | new bucket `SECRET_ACCESS_KEY` |
| `AWS_DEFAULT_REGION`, `S3_REGION` | new bucket `REGION` |

**Clear `S3_PUBLIC_URL`.** If it currently points at the old bucket's public
address, leaving it set sends every image request to a bucket that's about to be
deleted. Empty is the safe setting — the app falls back to its own
`/api/files/<key>` proxy, which reads through whatever bucket is configured.

The bucket now lives outside this project, so traffic to it goes over the public
S3 endpoint instead of Railway's private network. That's expected and works;
`getServerUrl` in `lib/storage.ts` presigns URLs either way.

Redeploy both, then check in the app that logos, avatars, tool logos, and a
fresh render all load. The old bucket still exists at this point, so if anything
is wrong you can put the old values back.

## 7. Delete and transfer

Only once step 6 is confirmed working:

1. Delete the temporary copy service.
2. Delete the old Bucket from the project.
3. Project Settings → **Transfer Project** → pick the destination workspace.

If the destination is a different login rather than another workspace on the
same login, it's Settings → Members → invite that email → then the three dots
next to them → **Transfer Ownership**. They get a confirmation email and have
24 hours to accept.

## 8. Optional — fold the bucket back in

Leaving the bucket in its own project is fine and needs no further work. If you
would rather have one project again, now that the transfer has landed:

1. Add a Bucket to the transferred project.
2. Re-deploy the copy service there with `SRC_*` = the holding bucket's values
   and `DST_*` = the new in-project bucket.
3. Swap the literal values on `main` and `worker` back to `${{Bucket.*}}`
   references.
4. Delete the holding project.

## Why the code changed

Uploads are stored in the database as absolute URLs
(`https://<endpoint>/<bucket>/tools/abc.png`), so a row written against the old
bucket keeps the old address forever. `extractKeyFromUrl` in `lib/storage.ts`
recovers the object key from those URLs so they can be re-pointed at the current
bucket on read — but its fallback pattern only matched `logos` and `renders`,
while uploads actually use five prefixes. Avatars, tool logos, and skills would
have 404'd against a deleted bucket.

Two fixes, both needed before step 6:

- `lib/storage.ts` — the fallback covers all five prefixes (`KEY_PREFIXES`).
  `tests/storage-keys.test.ts` asserts every prefix survives a bucket change.
- `app/api/tools/route.ts`, `app/api/admin/tools/route.ts` — these returned the
  raw stored `logoUrl` without passing it through `refreshUrl`, so no amount of
  key recovery would have helped. They now refresh on read like every other
  surface.

Adding a new upload prefix later means adding it to `KEY_PREFIXES` — the test
fails if a prefix is unrecoverable.
