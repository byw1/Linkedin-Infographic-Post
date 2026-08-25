# Viral

An internal Shifu Labs tool. It turns HTML from Claude into finished
LinkedIn images and keeps the numbers those posts earn.

## What it does

Three output formats, one flow each:

- **Infographic** — paste a single HTML file, resolve any company logos
  against the shared library, export a 1080×1350 PNG.
- **Carousel** — drop a zip of 1080×1080 slide HTMLs, resolve logos once
  across the set, export a multi-page PDF for LinkedIn documents.
- **Tweet** — compose a tweet card and export it as a 1080×1350 PNG.

Around that: a shared logo library, brand themes, a post wall with
tracked impressions, a member directory, and a docs section holding the
team's skills and tool catalog.

## Access

Invite-only. First run creates the admin account at `/setup`. After
that, members arrive by invite or by an approved request at
`/welcome/request`. Admins manage both from `/admin`.

## Local setup

Requires Node 20+, Postgres, and Redis. Storage is S3-compatible.

```
npm install
cp .env.example .env.local     # fill in DATABASE_URL, AUTH_SECRET, S3_*
npx prisma migrate deploy
npm run dev
```

Rendering runs in a separate worker process:

```
npm run worker
```

Without Redis the app still runs; queued renders will not complete, and
`/admin/health` will say so. Without S3 credentials, export is disabled
and the app says that too.

## Commands

```
npm run dev         # Next dev server
npm run build       # prisma generate + next build
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run worker      # render worker (needs Redis)
```

## Deploy

Railway, in the `@bywilliaml` workspace. Two services off this repo: the
web app (`Dockerfile`) and the render worker (`Dockerfile.worker`).
Migrations run with `npx prisma migrate deploy`. The app is served at
`viral.bywilliaml.com`.

## Design

The interface follows the Shifu Labs brand system: four inks
(Off-Black `#101010`, Chalk `#F1EFEA`, Concrete `#55534E`, Signal
`#FF4D00`), no border radii, no shadows, no gradients, and motion
limited to functional state changes.

Both rules are enforced structurally — `tailwind.config.ts` empties the
`borderRadius` and `boxShadow` scales, so `rounded-*` and `shadow-*`
do not compile.

**One deliberate exception.** `components/tweet-preview.tsx` pins its
geometry with inline styles. It is the html-to-image capture target, so
anything it took from the theme would be baked into users' exported
PNGs — emptying the radius scale would silently turn every exported
avatar into a square. Leave those inline styles alone.

Generated slides and carousels are user-authored HTML rendered in an
iframe or by Puppeteer. They never see the app's stylesheet, and the
brand rules do not apply to them.
