import { prisma } from "@/lib/db";

// The token keys the editable picker exposes. Anything else in a
// pasted CSS file is preserved verbatim in `css` but ignored when we
// build the skill-prompt block. Order is meaningful — it's how tokens
// appear in the skill markdown.
export const EDITABLE_TOKENS = [
  "--bg-canvas",
  "--bg-panel",
  "--bg-panel-raised",
  "--bg-inset",
  "--fg-primary",
  "--fg-secondary",
  "--fg-tertiary",
  "--fg-muted",
  "--fg-on-accent",
  "--edge-hairline",
  "--edge-strong",
  "--accent",
  "--accent-hover",
  "--accent-soft",
  "--signal",
  "--signal-success",
  "--signal-warn",
  "--signal-error",
  "--font-sans",
  "--font-display",
  "--font-mono",
] as const;

export type TokenKey = (typeof EDITABLE_TOKENS)[number];
export type Tokens = Partial<Record<TokenKey, string>>;

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
    const key = match[1] as TokenKey;
    if (!(EDITABLE_TOKENS as readonly string[]).includes(key)) continue;
    out[key] = match[2].trim();
  }
  return out;
}

// Cheap font-family extraction for the picker preview. Pulls the
// first quoted family name out of `--font-sans`, falling back to the
// raw value if nothing's quoted.
export function extractFontFamily(tokens: Tokens): string | null {
  const sans = tokens["--font-sans"];
  if (!sans) return null;
  const quoted = sans.match(/['"]([^'"]+)['"]/);
  if (quoted) return quoted[1];
  return sans.split(",")[0]?.trim() ?? null;
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
export function buildStyleCss(theme: { css: string; tokens: Tokens }): string {
  const isDark = isDarkTheme(theme.tokens);
  return [
    `:root { color-scheme: ${isDark ? "dark" : "light"}; }`,
    theme.css,
    THEME_OVERRIDES,
  ].join("\n");
}

// Always-on overrides appended after the user's theme CSS. These map
// the canonical tokens onto html/body with !important so HTML that
// pre-dates the theme system (and hard-codes colors) still flips its
// canvas + text + font when the user picks a different theme. Charts,
// gradient buttons, etc. still hold their hard-coded colors — fully
// theming those needs HTML that references var(--token) directly.
const THEME_OVERRIDES = `
/* viral theme overrides — flip canvas/text/font even on HTML that
   doesn't reference var(--bg-canvas). Remove these once the source
   HTML uses tokens throughout. */
html {
  background-color: var(--bg-canvas) !important;
}
body {
  background-color: var(--bg-canvas) !important;
  color: var(--fg-primary) !important;
  font-family: var(--font-sans) !important;
}
`;

// Heuristic: "is the canvas darker than the foreground?" → dark theme.
// Works for hex (#0a0a0a) and rgb(...) tokens; defaults to dark if
// either is missing or unparseable.
function isDarkTheme(tokens: Tokens): boolean {
  const bg = relativeLuma(tokens["--bg-canvas"]);
  const fg = relativeLuma(tokens["--fg-primary"]);
  if (bg === null || fg === null) return true;
  return bg < fg;
}

function relativeLuma(value: string | undefined): number | null {
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
    "**Usage rules.** Surfaces use `--bg-*`, text uses `--fg-*`, dividers/borders use `--edge-*`, the brand color is `--accent` (with `--accent-hover` for hover, `--accent-soft` for low-contrast fills), `--signal` is the single attention color (use sparingly — one element per slide). Headings use `--font-display`, body uses `--font-sans`, numeric readouts use `--font-mono`.",
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
