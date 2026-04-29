-- Brand themes. CSS token blocks (`--bg-canvas`, `--accent`, font
-- family, etc.) injected into the editor preview, the puppeteer
-- renderer, and the served skill markdown.
--
-- Owner / visibility rules:
--   user_id = NULL                       → system theme; always official.
--   user_id = <uuid>, is_official = FALSE → private to owner + admins.
--   user_id = <uuid>, is_official = TRUE  → admin-promoted; visible to all,
--                                           edit restricted to owner + admins.
CREATE TABLE "themes" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"      UUID,
  "name"         TEXT NOT NULL,
  "css"          TEXT NOT NULL,
  "tokens"       JSONB NOT NULL DEFAULT '{}'::jsonb,
  "font_family"  TEXT,
  "is_official"  BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "themes_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_themes_user" ON "themes" ("user_id", "created_at" DESC);
CREATE INDEX "idx_themes_official" ON "themes" ("is_official");

-- Renders remember which theme they were rendered with so the same
-- render shows the same colors when re-opened. SET NULL on theme
-- delete keeps the render row intact.
ALTER TABLE "renders"
  ADD COLUMN "theme_id" UUID,
  ADD CONSTRAINT "renders_theme_id_fkey" FOREIGN KEY ("theme_id")
    REFERENCES "themes" ("id") ON DELETE SET NULL;

-- Seed the two system defaults. These match the dark LinkedIn-post
-- vibe the app ships with today, plus a light counterpart. Admins can
-- rename / unpublish them, but they're inserted with user_id = NULL
-- so they belong to the system, not any one admin.
INSERT INTO "themes" ("name", "css", "tokens", "font_family", "is_official", "user_id")
VALUES
(
  'Default — Dark',
  $css$/* Default Dark — viral's stock LinkedIn-post look. Restrained,
   contrasty, indigo accent, amber signal. */
:root, [data-theme="dark"] {
  --bg-canvas: #0a0a0a;
  --bg-panel: #161616;
  --bg-panel-raised: #1f1f1f;
  --bg-inset: #050505;

  --fg-primary: #fafafa;
  --fg-secondary: #d4d4d4;
  --fg-tertiary: #a3a3a3;
  --fg-muted: #737373;
  --fg-on-accent: #ffffff;

  --edge-hairline: rgba(255,255,255,0.08);
  --edge-strong: rgba(255,255,255,0.16);

  --accent: #6366f1;
  --accent-hover: #818cf8;
  --accent-soft: rgba(99,102,241,0.12);

  --signal: #f59e0b;
  --signal-success: #10b981;
  --signal-warn: #f59e0b;
  --signal-error: #ef4444;

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
}
$css$,
  $tokens$
  {
    "--bg-canvas": "#0a0a0a",
    "--bg-panel": "#161616",
    "--bg-panel-raised": "#1f1f1f",
    "--bg-inset": "#050505",
    "--fg-primary": "#fafafa",
    "--fg-secondary": "#d4d4d4",
    "--fg-tertiary": "#a3a3a3",
    "--fg-muted": "#737373",
    "--fg-on-accent": "#ffffff",
    "--edge-hairline": "rgba(255,255,255,0.08)",
    "--edge-strong": "rgba(255,255,255,0.16)",
    "--accent": "#6366f1",
    "--accent-hover": "#818cf8",
    "--accent-soft": "rgba(99,102,241,0.12)",
    "--signal": "#f59e0b",
    "--signal-success": "#10b981",
    "--signal-warn": "#f59e0b",
    "--signal-error": "#ef4444",
    "--font-sans": "Inter",
    "--font-display": "Inter",
    "--font-mono": "JetBrains Mono"
  }
  $tokens$::jsonb,
  'Inter',
  TRUE,
  NULL
),
(
  'Default — Light',
  $css$/* Default Light — same palette as Default Dark, inverted for
   light surfaces. Same accent, same signal — only neutrals flip. */
:root, [data-theme="light"] {
  --bg-canvas: #ffffff;
  --bg-panel: #fafafa;
  --bg-panel-raised: #ffffff;
  --bg-inset: #f5f5f5;

  --fg-primary: #0a0a0a;
  --fg-secondary: #404040;
  --fg-tertiary: #737373;
  --fg-muted: #a3a3a3;
  --fg-on-accent: #ffffff;

  --edge-hairline: rgba(0,0,0,0.08);
  --edge-strong: rgba(0,0,0,0.18);

  --accent: #4f46e5;
  --accent-hover: #6366f1;
  --accent-soft: rgba(79,70,229,0.10);

  --signal: #d97706;
  --signal-success: #059669;
  --signal-warn: #d97706;
  --signal-error: #dc2626;

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
}
$css$,
  $tokens$
  {
    "--bg-canvas": "#ffffff",
    "--bg-panel": "#fafafa",
    "--bg-panel-raised": "#ffffff",
    "--bg-inset": "#f5f5f5",
    "--fg-primary": "#0a0a0a",
    "--fg-secondary": "#404040",
    "--fg-tertiary": "#737373",
    "--fg-muted": "#a3a3a3",
    "--fg-on-accent": "#ffffff",
    "--edge-hairline": "rgba(0,0,0,0.08)",
    "--edge-strong": "rgba(0,0,0,0.18)",
    "--accent": "#4f46e5",
    "--accent-hover": "#6366f1",
    "--accent-soft": "rgba(79,70,229,0.10)",
    "--signal": "#d97706",
    "--signal-success": "#059669",
    "--signal-warn": "#d97706",
    "--signal-error": "#dc2626",
    "--font-sans": "Inter",
    "--font-display": "Inter",
    "--font-mono": "JetBrains Mono"
  }
  $tokens$::jsonb,
  'Inter',
  TRUE,
  NULL
);
