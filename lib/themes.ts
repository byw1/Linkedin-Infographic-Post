import { prisma } from "@/lib/db";
import { ensureFontImports } from "@/lib/theme-fonts";

// The token keys the editable picker exposes. Anything else in a
// pasted CSS file is preserved verbatim in `css` but ignored when we
// build the skill-prompt block. Order is meaningful — it's how tokens
// appear in the skill markdown.
//
// Naming follows the convention the team's existing generated HTML
// already uses (--color-text-primary, --color-background-primary,
// etc.) so HTML that already references `var(--color-text-primary)`
// just works on theme swap, no regeneration needed.
export const EDITABLE_TOKENS = [
  "--color-background-primary",
  "--color-background-secondary",
  "--color-background-tertiary",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-text-on-accent",
  "--color-border-primary",
  "--color-border-secondary",
  "--color-border-tertiary",
  "--color-accent-primary",
  "--color-accent-secondary",
  "--color-accent-soft",
  "--color-accent-text",
  "--color-signal-success",
  "--color-signal-warn",
  "--color-signal-error",
  "--font-family-base",
  "--font-family-display",
  "--font-family-mono",
  "--border-radius-sm",
  "--border-radius-md",
  "--border-radius-lg",
] as const;

export type TokenKey = (typeof EDITABLE_TOKENS)[number];
// Tokens map captures *every* `--*` declaration in the CSS, not just
// the canonical list — older themes (or pasted ones) may use legacy
// names like `--bg-canvas`, `--fg-primary`, `--accent`, and we still
// want them parsed so the picker swatches render and the !important
// override below can fall back through them.
export type Tokens = Record<string, string>;

// Legacy name → new canonical name. Used to widen swatch lookups and
// to feed both names into the !important fallback chain so a pasted
// theme works regardless of which convention it uses.
export const LEGACY_ALIASES: Record<string, string> = {
  "--bg-canvas": "--color-background-primary",
  "--bg-panel": "--color-background-secondary",
  "--bg-panel-raised": "--color-background-tertiary",
  "--fg-primary": "--color-text-primary",
  "--fg-secondary": "--color-text-secondary",
  "--fg-tertiary": "--color-text-tertiary",
  "--fg-on-accent": "--color-text-on-accent",
  "--edge-strong": "--color-border-primary",
  "--edge-hairline": "--color-border-tertiary",
  "--accent": "--color-accent-primary",
  "--accent-hover": "--color-accent-secondary",
  "--accent-soft": "--color-accent-soft",
  "--signal-success": "--color-signal-success",
  "--signal-warn": "--color-signal-warn",
  "--signal-error": "--color-signal-error",
  "--font-sans": "--font-family-base",
  "--font-display": "--font-family-display",
  "--font-mono": "--font-family-mono",
};

export interface ThemeRow {
  id: string;
  userId: string | null;
  name: string;
  css: string;
  tokens: Tokens;
  fontFamily: string | null;
  isOfficial: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Pull the editable subset of tokens out of a raw CSS block. We don't
// run a real CSS parser — token files are flat `--key: value;` lines
// inside one or two `:root` / `[data-theme="..."]` blocks, so a regex
// over the whole text picks up the last definition of each key (last
// wins, matching CSS cascade for a single sheet).
export function parseTokens(css: string): Tokens {
  const out: Tokens = {};
  const re = /(--[a-zA-Z][\w-]*)\s*:\s*([^;}\n]+)\s*[;}\n]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    out[match[1]] = match[2].trim();
  }
  return out;
}

// Look up a token, then its legacy alias (or vice versa) so callers
// can ask for the canonical name and still find a value if the
// pasted CSS only defined the older name.
export function getToken(tokens: Tokens, key: string): string | undefined {
  const direct = tokens[key];
  if (direct) return direct;
  const reverseAlias = Object.entries(LEGACY_ALIASES).find(([, v]) => v === key);
  if (reverseAlias && tokens[reverseAlias[0]]) return tokens[reverseAlias[0]];
  const forwardAlias = LEGACY_ALIASES[key];
  if (forwardAlias && tokens[forwardAlias]) return tokens[forwardAlias];
  return undefined;
}

// Cheap font-family extraction for the picker preview. Pulls the
// first quoted family name out of `--font-family-base`, falling back
// to the raw value if nothing's quoted.
export function extractFontFamily(tokens: Tokens): string | null {
  const base = getToken(tokens, "--font-family-base");
  if (!base) return null;
  const quoted = base.match(/['"]([^'"]+)['"]/);
  if (quoted) return quoted[1];
  return base.split(",")[0]?.trim() ?? null;
}

// Build a `<style>` block to inject into the iframe / puppeteer page.
// The injected CSS sets the theme's tokens at `:root` so any HTML
// authored against `var(--bg-canvas)` etc. just works. We also set
// `color-scheme` so form controls / scrollbars match, and append a
// short !important override that flips body/html colors + font even
// when the source HTML hard-coded them — without that, switching from
// a dark to a light theme on legacy generated HTML looks like
// nothing changed because the body's `background: #0a0a0a` style
// shadows the new `--bg-canvas` token entirely.
export function buildStyleTag(theme: { css: string; tokens: Tokens }): string {
  return `<style data-viral-theme>\n${buildStyleCss(theme)}\n</style>`;
}

// Same content, no `<style>` wrapper — for places that want raw CSS
// (puppeteer's addStyleTag, the editor's createElement('style')).
// Auto-prepends `@import` for any Google Fonts the theme references
// but didn't load itself, so a CSS-tab-pasted theme using 'Figtree'
// renders in Figtree even if the user forgot the import line.
export function buildStyleCss(theme: { css: string; tokens: Tokens }): string {
  const isDark = isDarkTheme(theme.tokens);
  return [
    `:root { color-scheme: ${isDark ? "dark" : "light"}; }`,
    ensureFontImports(theme.css),
    THEME_OVERRIDES,
  ].join("\n");
}

// Always-on overrides appended after the user's theme CSS. These map
// the canonical tokens onto html/body with !important so HTML that
// pre-dates the theme system (and hard-codes colors) still flips its
// canvas + text + font when the user picks a different theme. Charts,
// gradient buttons, etc. still hold their hard-coded colors — fully
// theming those needs HTML that references var(--token) directly.
// var() fallback chains accept either the canonical --color-* /
// --font-family-* names or the legacy --bg-* / --fg-* / --accent /
// --font-sans names a pasted theme might still use, so the override
// flips body colors regardless of which convention the theme uses.
const THEME_OVERRIDES = `
/* viral theme overrides — flip canvas/text/font even on HTML that
   doesn't reference these tokens directly. */
html {
  background-color: var(--color-background-primary, var(--bg-canvas)) !important;
}
body {
  background-color: var(--color-background-primary, var(--bg-canvas)) !important;
  color: var(--color-text-primary, var(--fg-primary)) !important;
  font-family: var(--font-family-base, var(--font-sans)) !important;
}
`;

// Heuristic: "is the canvas darker than the foreground?" → dark theme.
// Works for hex (#0a0a0a) and rgb(...) tokens; defaults to dark if
// either is missing or unparseable.
function isDarkTheme(tokens: Tokens): boolean {
  const bg = relativeLuma(getToken(tokens, "--color-background-primary"));
  const fg = relativeLuma(getToken(tokens, "--color-text-primary"));
  if (bg === null || fg === null) return true;
  return bg < fg;
}

function relativeLuma(value: string | null | undefined): number | null {
  if (!value) return null;
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    const full =
      h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return (
      (0.299 * Number(rgb[1]) +
        0.587 * Number(rgb[2]) +
        0.114 * Number(rgb[3])) /
      255
    );
  }
  return null;
}

// Format tokens as a compact markdown block to append to the served
// skill content. Claude reads this and emits HTML that uses the same
// `var(--bg-canvas)` references — same tokens then end up applied at
// render time via `buildStyleTag`.
export function tokensAsSkillBlock(theme: ThemeRow): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`## Brand tokens — "${theme.name}"`);
  lines.push("");
  lines.push(
    "Use these CSS variables in the HTML you generate. Reference them as `var(--token)` in inline styles or in a single `<style>` block at the top of the document. Do not hard-code colors or fonts when an equivalent token exists.",
  );
  lines.push("");
  lines.push("```css");
  lines.push(":root {");
  for (const key of EDITABLE_TOKENS) {
    const v = theme.tokens[key];
    if (v) lines.push(`  ${key}: ${v};`);
  }
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push(
    "**Usage rules.** Surfaces use `--color-background-*` (primary = canvas, secondary = panels, tertiary = raised cards within panels). Text uses `--color-text-*` (primary = body, secondary = sub-copy, tertiary = captions/credits). Dividers/borders use `--color-border-*`. The brand color is `--color-accent-primary` with `--color-accent-secondary` for lighter highlights and `--color-accent-soft` as a low-contrast fill behind `--color-accent-text`. Use `--color-signal-*` sparingly — at most one signal element per slide. Body type uses `--font-family-base`, numerics use `--font-family-mono`. Card and pill radii use `--border-radius-md`.",
  );
  lines.push("");
  return lines.join("\n");
}

// Fetch a theme by id with the membership check baked in — a member
// can only fetch their own themes or any official theme; admins see
// everything. Returns null when the theme doesn't exist or the caller
// can't see it.
export async function fetchThemeForUser(
  themeId: string,
  user: { id: string; role: "user" | "admin" },
): Promise<ThemeRow | null> {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme) return null;
  if (user.role === "admin") return toRow(theme);
  if (theme.isOfficial) return toRow(theme);
  if (theme.userId === user.id) return toRow(theme);
  return null;
}

// List the themes a user can pick from in the editor: their own +
// every official theme. Officials sort first (alphabetical), then
// the user's own (most recently updated first) so the picker stays
// predictable.
export async function listThemesForUser(userId: string): Promise<ThemeRow[]> {
  const rows = await prisma.theme.findMany({
    where: {
      OR: [{ isOfficial: true }, { userId }],
    },
  });
  const officials = rows
    .filter((r) => r.isOfficial)
    .sort((a, b) => a.name.localeCompare(b.name));
  const owned = rows
    .filter((r) => !r.isOfficial && r.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return [...officials, ...owned].map(toRow);
}

function toRow(theme: {
  id: string;
  userId: string | null;
  name: string;
  css: string;
  tokens: unknown;
  fontFamily: string | null;
  isOfficial: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ThemeRow {
  return {
    id: theme.id,
    userId: theme.userId,
    name: theme.name,
    css: theme.css,
    tokens: (theme.tokens ?? {}) as Tokens,
    fontFamily: theme.fontFamily,
    isOfficial: theme.isOfficial,
    createdAt: theme.createdAt,
    updatedAt: theme.updatedAt,
  };
}
