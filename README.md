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
# Fill in DATABASE_URL, REDIS_URL, AUTH_SECRET, GOOGLE_CLIENT_*,
# ALLOWED_EMAILS, and S3_* if you want PNG export to work locally.

npm install
npx prisma migrate dev
npm run dev          # web on :3000
npm run worker       # render worker (separate terminal)
```

### Environment variables

See `.env.example` for the full list. Key ones:

- `DATABASE_URL` — Postgres connection string (Railway-managed)
- `REDIS_URL` — Redis connection string (Railway-managed)
- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_TRUST_HOST=true` (for Railway / proxies)
- `NEXTAUTH_URL` — full origin, e.g. `https://logoswap.yourdomain.com`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `ALLOWED_EMAILS` — comma-separated allowlist (no DB migration to add/remove)
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` (worker container)

## Tests

```bash
npm test
```

Vitest covers `lib/parser.ts` (10 tests) and `lib/replacer.ts` (6 tests).
Add more under `tests/` or co-located as `lib/**/*.test.ts`.

## Deploy on Railway

Five services in one project:

1. **Postgres** — Railway-managed; sets `DATABASE_URL`
2. **Redis** — Railway-managed; sets `REDIS_URL`
3. **web** — this repo, `Dockerfile`. Runs `prisma migrate deploy` then `next start`
4. **worker** — this repo, `Dockerfile.worker`. Runs `node dist/workers/render-worker.js`
5. **MinIO** *(optional)* — only if you don't want Cloudflare R2

Set the env vars from `.env.example` on **both** the web and worker
services. Add a custom domain on the web service.

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
they stay independent. Sign-in is gated by an email allowlist; emails
not in `ALLOWED_EMAILS` are rejected at the `signIn` callback before any
database row is created beyond the Auth.js account record.

## Status

V1 scaffolding. Working: project setup, Prisma schema, Auth.js with
allowlist, S3 / Redis / BullMQ wiring, parser + replacer + Puppeteer
exporter, render worker, both Dockerfiles, Vitest tests.

Not yet built: API routes (`/api/parse`, `/api/entities*`,
`/api/render*`, `/api/library`, `/api/me`), upload dropzone, entity
resolver UI, library grid, render preview page, the first
`prisma migrate dev` migration.
