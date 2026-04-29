-- Reseed the two system default themes (user_id IS NULL) with token
-- names + values that match the team's actual generated HTML — warm
-- charcoal/cream neutrals, indigo accent, system font stack.
--
-- Why an UPDATE instead of editing the original seed migration:
-- migrations are checksummed once applied, so rewriting the original
-- would break Prisma's history check on any DB that already ran it.
-- This migration is idempotent — safe to re-run after another schema
-- change reseeds them.
UPDATE "themes" SET
  "css" = $css$/* Default — Dark. Warm charcoal canvas, cream text,
   indigo accent. Mirrors the team's existing
   prefers-color-scheme: dark generated HTML so existing posts
   render the same with this theme as without. */
:root, [data-theme="dark"] {
  --color-background-primary: #191919;
  --color-background-secondary: #252422;
  --color-background-tertiary: #2e2c2a;

  --color-text-primary: #e8e6de;
  --color-text-secondary: #b8b6ae;
  --color-text-tertiary: #868378;
  --color-text-on-accent: #ffffff;

  --color-border-primary: rgba(255,255,255,0.18);
  --color-border-secondary: rgba(255,255,255,0.12);
  --color-border-tertiary: rgba(255,255,255,0.08);

  --color-accent-primary: #534AB7;
  --color-accent-secondary: #AFA9EC;
  --color-accent-soft: rgba(83,74,183,0.18);
  --color-accent-text: #d6d2f5;

  --color-signal-success: #00C853;
  --color-signal-warn: #f59e0b;
  --color-signal-error: #ef4444;

  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-display: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;

  --border-radius-sm: 6px;
  --border-radius-md: 10px;
  --border-radius-lg: 16px;
}
$css$,
  "tokens" = $tokens$
  {
    "--color-background-primary": "#191919",
    "--color-background-secondary": "#252422",
    "--color-background-tertiary": "#2e2c2a",
    "--color-text-primary": "#e8e6de",
    "--color-text-secondary": "#b8b6ae",
    "--color-text-tertiary": "#868378",
    "--color-text-on-accent": "#ffffff",
    "--color-border-primary": "rgba(255,255,255,0.18)",
    "--color-border-secondary": "rgba(255,255,255,0.12)",
    "--color-border-tertiary": "rgba(255,255,255,0.08)",
    "--color-accent-primary": "#534AB7",
    "--color-accent-secondary": "#AFA9EC",
    "--color-accent-soft": "rgba(83,74,183,0.18)",
    "--color-accent-text": "#d6d2f5",
    "--color-signal-success": "#00C853",
    "--color-signal-warn": "#f59e0b",
    "--color-signal-error": "#ef4444",
    "--font-family-base": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "--font-family-display": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "--font-family-mono": "ui-monospace, 'JetBrains Mono', Menlo, monospace",
    "--border-radius-sm": "6px",
    "--border-radius-md": "10px",
    "--border-radius-lg": "16px"
  }
  $tokens$::jsonb,
  "font_family" = '-apple-system'
WHERE "user_id" IS NULL AND "name" = 'Default — Dark';

UPDATE "themes" SET
  "css" = $css$/* Default — Light. Warm white canvas, charcoal text,
   indigo accent. Mirrors the team's existing default :root from
   generated HTML so existing posts render the same with this
   theme as without. */
:root, [data-theme="light"] {
  --color-background-primary: #ffffff;
  --color-background-secondary: #f5f5f4;
  --color-background-tertiary: #ebebe9;

  --color-text-primary: #1a1a1a;
  --color-text-secondary: #555555;
  --color-text-tertiary: #888888;
  --color-text-on-accent: #ffffff;

  --color-border-primary: rgba(0,0,0,0.18);
  --color-border-secondary: rgba(0,0,0,0.12);
  --color-border-tertiary: rgba(0,0,0,0.06);

  --color-accent-primary: #534AB7;
  --color-accent-secondary: #AFA9EC;
  --color-accent-soft: #EEEDFE;
  --color-accent-text: #26215C;

  --color-signal-success: #00C853;
  --color-signal-warn: #d97706;
  --color-signal-error: #dc2626;

  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-display: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;

  --border-radius-sm: 6px;
  --border-radius-md: 10px;
  --border-radius-lg: 16px;
}
$css$,
  "tokens" = $tokens$
  {
    "--color-background-primary": "#ffffff",
    "--color-background-secondary": "#f5f5f4",
    "--color-background-tertiary": "#ebebe9",
    "--color-text-primary": "#1a1a1a",
    "--color-text-secondary": "#555555",
    "--color-text-tertiary": "#888888",
    "--color-text-on-accent": "#ffffff",
    "--color-border-primary": "rgba(0,0,0,0.18)",
    "--color-border-secondary": "rgba(0,0,0,0.12)",
    "--color-border-tertiary": "rgba(0,0,0,0.06)",
    "--color-accent-primary": "#534AB7",
    "--color-accent-secondary": "#AFA9EC",
    "--color-accent-soft": "#EEEDFE",
    "--color-accent-text": "#26215C",
    "--color-signal-success": "#00C853",
    "--color-signal-warn": "#d97706",
    "--color-signal-error": "#dc2626",
    "--font-family-base": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "--font-family-display": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "--font-family-mono": "ui-monospace, 'JetBrains Mono', Menlo, monospace",
    "--border-radius-sm": "6px",
    "--border-radius-md": "10px",
    "--border-radius-lg": "16px"
  }
  $tokens$::jsonb,
  "font_family" = '-apple-system'
WHERE "user_id" IS NULL AND "name" = 'Default — Light';
