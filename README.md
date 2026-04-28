# LogoSwap

Self-hosted webapp that auto-replaces green logo placeholders in HTML
infographics with real logos from a learned, per-user library. Built for
a small invite-only group of LinkedIn posters.

Drop in HTML → resolved entities are auto-filled from your library →
upload logos for the unknowns once → server-side Puppeteer renders a
sharp 2×-resolution PNG ready to post. Each logo gets uploaded once;
your library compounds.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript strict |
| UI | Tailwind CSS + shadcn/ui primitives |
| Database | Postgres via Prisma |
| Cache / Queue | Redis (sessions, parse cache, BullMQ render queue) |
| Auth | Auth.js (NextAuth v5) — email + password by default, optional Google SSO, invite-link onboarding |
| Storage | S3-compatible (Cloudflare R2 recommended; MinIO works the same) |
| HTML parse | `cheerio` |
| PNG export | `puppeteer-core` + Chromium, in a separate worker service |
| Hosting | Railway (Postgres + Redis + web + worker services) |

## Repo layout

```
app/                       Next.js App Router pages + API routes
  api/auth/[...nextauth]/  Auth.js handler
  auth/signin, auth/error  Sign-in + error pages
lib/
  auth.ts                  Auth.js config + allowlist guard
  db.ts                    Prisma client
  redis.ts                 ioredis client
  queue.ts                 BullMQ render queue
  storage.ts               S3-compatible upload
  cache.ts                 Redis parse cache
  ratelimit.ts             @upstash/ratelimit
  parser.ts                extractEntities(html)
  replacer.ts              replaceEntities(html, mapping)
  exporter.ts              htmlToPng() via Puppeteer
  slug-utils.ts            Slug helpers
workers/
  render-worker.ts         BullMQ worker (separate process)
prisma/
  schema.prisma            Users, accounts, sessions, entities, renders
tests/
  parser.test.ts           10 tests
  replacer.test.ts         6 tests
types/                     Shared TS types
Dockerfile                 Web service
Dockerfile.worker          Worker (with Chromium runtime deps)
railway.json               Railway config for the web service
railway.worker.json        Railway config for the worker service
```

## Local development

Requires Node 20+, a running Postgres, and a running Redis.

```bash
cp .env.example .env.local
# Fill in the 4 required vars. Storage/allowlist configured in /admin.

npm install
npx prisma migrate dev
npm run dev          # web on :3000
npm run worker       # render worker (separate terminal)
```

## Deploy on Railway

The setup is intentionally minimal. Storage credentials and the email
allowlist live in the database and are managed from `/admin` inside the
running app — not in env vars.

### One-time Railway setup

1. **Create a project** → add **PostgreSQL** and **Redis** managed services.
2. **Add a `web` service** from this GitHub repo. Config-as-code path =
   `railway.json` (builds `Dockerfile`).
3. **Add a `worker` service** from the same repo. Config-as-code path =
   `railway.worker.json` (builds `Dockerfile.worker`).
4. On **both** services, set these **3 secrets**:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   AUTH_SECRET=<openssl rand -base64 32>
   ```
5. Generate a domain on the `web` service.

That's the entire Railway-side setup. No `NEXTAUTH_URL`,
`AUTH_TRUST_HOST`, `GOOGLE_*`, `BOOTSTRAP_ADMIN_EMAIL`,
`ALLOWED_EMAILS`, or `S3_*` required.

### First-time in-app setup

1. Visit `https://<your-domain>` — you'll land on the **`/setup`** wizard
   because no users exist yet. Create the first account with email +
   password. That account is automatically the admin.
2. Open `/admin`:
   - **Invites** — generate a shareable link, send it to a friend in
     iMessage / Slack. They open it, set their own password, and they're
     in. Links expire in 14 days.
   - **Sign-in providers** — *optional.* Paste Google OAuth credentials
     to add a "Continue with Google" button. Add the callback URL
     `https://<your-domain>/api/auth/callback/google` in Google Cloud
     Console.
   - **Storage** — paste R2 / MinIO endpoint, bucket, public URL, and keys.
     Saved to the `settings` table; the worker reads them per-render, so no
     restart needed.

## Tests

```bash
npm test
```

Vitest covers `lib/parser.ts` (10 tests) and `lib/replacer.ts` (6 tests).
Add more under `tests/` or co-located as `lib/**/*.test.ts`.

## How it works

1. User uploads an HTML infographic (output from the LinkedIn viral-posts
   skill). Every placeholder div carries `data-entity="some-slug"`.
2. `lib/parser.ts` walks the DOM, groups by slug, infers shape (circle vs
   square from `border-radius`) and size hints.
3. The webapp looks each slug up in the user's `entities` table.
4. Resolved entities auto-fill; unresolved ones prompt for a file upload
   or image URL — saved to S3 and back into the user's library.
5. `lib/replacer.ts` swaps every green placeholder for an `<img>` tag
   that preserves width / height / border-radius / margins.
6. The render is queued on BullMQ. The worker launches headless Chrome,
   waits for all images to load, auto-sizes the viewport to content
   height, screenshots at 2× DPR, uploads the PNG to S3, and updates the
   `renders` row with the public URL.
7. Client polls `GET /api/render/:id` and offers a download once status
   is `complete`.

## Auth model

- **Email + password** is the default. Passwords are hashed with bcrypt
  (12 rounds) and stored in `users.password_hash`. Sessions are JWTs
  (required by Auth.js when using the Credentials provider).
- **Invite links** are single-use, optionally email-locked, default 14-day
  TTL. Stored in the `invites` table. Admin generates from `/admin`,
  recipient sets their own password at `/invite/<token>`.
- **Google SSO is optional.** Paste OAuth credentials in
  `/admin → Sign-in providers` to enable. The provider list is rebuilt
  per request from settings (cached 30s), so changes don't require a
  redeploy. Google sign-in only works for users who already exist —
  Google auth doesn't auto-provision accounts; you still go through
  invite or setup first.

## Multi-user isolation

Every Prisma query filters by `user_id`. The `entities` table has
`UNIQUE(user_id, slug)`, so two users can both have a `tesla` entity and
they stay independent. The only ways to create a user are the first-run
`/setup` wizard (creates the admin, then locks itself) and admin-issued
invites — there's no public sign-up.

## Status

V1 scaffolding. Working: project setup, Prisma schema, Auth.js with
email+password Credentials + optional Google, first-run setup wizard,
admin-issued invite links, in-app `/admin` for invites, auth providers,
storage, and allowlist. S3 / Redis / BullMQ wiring, parser + replacer +
Puppeteer exporter, render worker, both Dockerfiles, Vitest tests.

Not yet built: core product API routes (`/api/parse`, `/api/entities*`,
`/api/render*`, `/api/library`, `/api/me`), upload dropzone, entity
resolver UI, library grid, render preview page.
