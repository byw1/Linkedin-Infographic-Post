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
| Auth | Auth.js (NextAuth v5) — Google SSO + email magic links + email allowlist |
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
railway.json               Railway build/deploy config
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
2. **Add a `web` service** from this GitHub repo. Build = `Dockerfile`.
3. **Add a `worker` service** from the same repo. Build = `Dockerfile.worker`.
4. On **both** services, set these 4 secrets:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   AUTH_SECRET=<openssl rand -base64 32>
   GOOGLE_CLIENT_ID=<from Google Cloud Console>
   GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
   BOOTSTRAP_ADMIN_EMAIL=<your email>
   ```
5. Generate a domain on the `web` service. Add it as the redirect URI
   in the Google OAuth client: `https://<domain>/api/auth/callback/google`.

That's the entire Railway-side setup. No `NEXTAUTH_URL`,
`AUTH_TRUST_HOST`, `ALLOWED_EMAILS`, or `S3_*` required.

### First-time in-app setup

1. Visit `https://<your-domain>` and sign in with Google as the
   `BOOTSTRAP_ADMIN_EMAIL`. The signIn callback bypasses the allowlist
   for that email and grants the `admin` role.
2. Open `/admin`:
   - **Storage** — paste R2 / MinIO endpoint, bucket, public URL, and keys.
     Saved to the `settings` table; the worker reads them per-render, so no
     restart needed.
   - **Email allowlist** — add the emails of friends who should be able
     to sign in. Saved to the `settings` table.

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

## Multi-user isolation

Every Prisma query filters by `user_id`. The `entities` table has a
`UNIQUE(user_id, slug)`, so two users can both have a `tesla` entity and
they stay independent. Sign-in is gated by a database-backed email
allowlist (managed from `/admin`); the `BOOTSTRAP_ADMIN_EMAIL` is always
allowed and is auto-promoted to `admin` on first login. Emails not on
the allowlist are rejected at the `signIn` callback before any user row
is created.

## Status

V1 scaffolding. Working: project setup, Prisma schema, Auth.js with
DB-backed allowlist + bootstrap admin, in-app `/admin` for storage and
allowlist, S3 / Redis / BullMQ wiring, parser + replacer + Puppeteer
exporter, render worker, both Dockerfiles, Vitest tests.

Not yet built: API routes (`/api/parse`, `/api/entities*`,
`/api/render*`, `/api/library`, `/api/me`), upload dropzone, entity
resolver UI, library grid, render preview page, the first
`prisma migrate dev` migration.
