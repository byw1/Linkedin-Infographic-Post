// Rewrite hard-coded hex colors in the source HTML's `style="…"`
// attributes to `var(--color-…)` references that match the active
// theme. This is the bridge between HTML Claude generated against a
// fixed palette (#534AB7, #EEEDFE, #26215C) and a theme system that
// wants to flip those colors when the user picks a different theme.
//
// **Scope.** Only `style="…"` inline attributes are rewritten. CSS
// inside `<style>` blocks is left alone (it often *defines* the
// tokens themselves, and rewriting would create circular references).
// JavaScript inside `<script>` blocks is left alone (chart libraries
// take literal hex values and can't resolve `var(--…)`).
//
// **Match strategy.** For every hex we find, we first try an exact
// match against the theme's token values; if none, we compute ΔE76
// in Lab space and accept the closest token if its distance is below
// `MAX_DELTA_E`. The threshold is set tight enough that a chart's
// distinct data colors aren't accidentally rewritten as accents.
//
// Pure function — no DOM, no prisma. Safe to import from both
// client components and the worker.

const REWRITEABLE_KEYS = [
  "--color-accent-primary",
  "--color-accent-secondary",
  "--color-accent-soft",
  "--color-accent-text",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-text-on-accent",
  "--color-background-primary",
  "--color-background-secondary",
  "--color-background-tertiary",
  "--color-signal-success",
  "--color-signal-warn",
  "--color-signal-error",
] as const;

// Canonical → legacy aliases. If a theme stores `--accent` instead of
// `--color-accent-primary`, we still find the value. Mirrors the
// alias map in lib/themes.ts; duplicated here so this file stays
// importable from both client + server without dragging in prisma.
const LEGACY_ALIASES: Record<string, string[]> = {
  "--color-background-primary": ["--bg-canvas"],
  "--color-background-secondary": ["--bg-panel"],
  "--color-background-tertiary": ["--bg-panel-raised"],
  "--color-text-primary": ["--fg-primary"],
  "--color-text-secondary": ["--fg-secondary"],
  "--color-text-tertiary": ["--fg-tertiary", "--fg-muted"],
  "--color-text-on-accent": ["--fg-on-accent"],
  "--color-accent-primary": ["--accent"],
  "--color-accent-secondary": ["--accent-hover"],
  "--color-signal-success": ["--signal-success"],
  "--color-signal-warn": ["--signal-warn", "--signal"],
  "--color-signal-error": ["--signal-error"],
};

// Hex values Claude's default skill output reaches for, mapped to
// the canonical role they fill. These are folded into the candidate
// set on every rewrite so HTML generated against the seeded default
// theme gets rewritten correctly even when the user is sitting on a
// completely different active theme. Active-theme tokens override
// these on overlap (so a custom theme's `#534AB7` still wins).
const WELL_KNOWN_HEXES: Record<string, string> = {
  // Indigo accent family — the default skill's house brand color.
  "#534ab7": "--color-accent-primary",
  "#afa9ec": "--color-accent-secondary",
  "#eeedfe": "--color-accent-soft",
  "#26215c": "--color-accent-text",
  "#3c3489": "--color-accent-text",
  // Warm neutrals from the default light theme.
  "#ffffff": "--color-background-primary",
  "#f5f5f4": "--color-background-secondary",
  "#ebebe9": "--color-background-tertiary",
  "#1a1a1a": "--color-text-primary",
  "#555555": "--color-text-secondary",
  "#888888": "--color-text-tertiary",
  // Dark counterparts.
  "#191919": "--color-background-primary",
  "#252422": "--color-background-secondary",
  "#2e2c2a": "--color-background-tertiary",
  "#e8e6de": "--color-text-primary",
  "#b8b6ae": "--color-text-secondary",
  "#868378": "--color-text-tertiary",
  // Signals.
  "#00c853": "--color-signal-success",
  "#10b981": "--color-signal-success",
  "#f59e0b": "--color-signal-warn",
  "#d97706": "--color-signal-warn",
  "#ef4444": "--color-signal-error",
  "#dc2626": "--color-signal-error",
};

// ΔE76 threshold: anything below this is treated as the same color.
// 5 is "small but visible", 8 is "noticeable but related". We use 8
// because Claude often emits subtly different shades of the same
// brand color (slight HSL drift between sibling cards), and we want
// those clustered into a single token.
const MAX_DELTA_E = 8;

interface Candidate {
  name: string;
  hex: string;
  lab: [number, number, number];
}

// Parse all `--key: value` declarations out of arbitrary CSS. Mirrors
// lib/themes.ts parseTokens — duplicated here so this file stays
// importable from client components without hauling in prisma.
export function parseCssTokens(css: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!css) return out;
  const re = /(--[a-zA-Z][\w-]*)\s*:\s*([^;}\n]+)\s*[;}\n]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

export function rewriteAccents(html: string, tokens: Record<string, string>): string {
  const candidates = buildCandidates(tokens);
  if (candidates.length === 0) return html;

  // Memoize per-hex decisions — the same `#534AB7` shows up many
  // times in a typical Claude artifact, no point re-deltaE-ing it.
  const cache = new Map<string, string>();

  function resolveHex(rawHex: string): string {
    const normalized = normalizeHex(rawHex);
    if (!normalized) return rawHex;
    const cached = cache.get(normalized);
    if (cached !== undefined) return cached;

    // Exact-match fast path. ~90% of Claude's output hits this.
    const exact = candidates.find((c) => c.hex === normalized);
    if (exact) {
      const out = `var(${exact.name})`;
      cache.set(normalized, out);
      return out;
    }

    const lab = hexToLab(normalized);
    if (!lab) {
      cache.set(normalized, rawHex);
      return rawHex;
    }

    let best: Candidate | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = deltaE76(lab, c.lab);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best && bestDist < MAX_DELTA_E) {
      const out = `var(${best.name})`;
      cache.set(normalized, out);
      return out;
    }
    cache.set(normalized, rawHex);
    return rawHex;
  }

  // Rewrite hex inside every `style="…"` attribute. Single quotes
  // (`style='…'`) handled separately so we don't escape badly. The
  // patterns are independent passes — a `style` attribute uses one
  // quote style at a time.
  return html
    .replace(/style="([^"]*)"/g, (_full, body) => {
      return `style="${rewriteHexInStyle(body, resolveHex)}"`;
    })
    .replace(/style='([^']*)'/g, (_full, body) => {
      return `style='${rewriteHexInStyle(body, resolveHex)}'`;
    });
}

function rewriteHexInStyle(
  styleBody: string,
  resolveHex: (hex: string) => string,
): string {
  return styleBody.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m) =>
    resolveHex(m),
  );
}

// DOM-mutation variant for the editor iframe — walks every element
// with a `style` attribute and rewrites hex values in place. Lets
// the editor re-apply rewrites on theme change without re-setting
// srcDoc (which would re-mount the iframe and restart any charts).
//
// Idempotent: once a hex has been replaced with `var(--…)`, the
// regex finds no hex on the next pass, so calling this multiple
// times is safe.
export function applyAccentRewriteToDocument(
  doc: Document,
  tokens: Record<string, string>,
): void {
  const candidates = buildCandidates(tokens);
  if (candidates.length === 0) return;

  const cache = new Map<string, string>();

  function resolveHex(rawHex: string): string {
    const normalized = normalizeHex(rawHex);
    if (!normalized) return rawHex;
    const cached = cache.get(normalized);
    if (cached !== undefined) return cached;
    const exact = candidates.find((c) => c.hex === normalized);
    if (exact) {
      const out = `var(${exact.name})`;
      cache.set(normalized, out);
      return out;
    }
    const lab = hexToLab(normalized);
    if (!lab) {
      cache.set(normalized, rawHex);
      return rawHex;
    }
    let best: Candidate | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = deltaE76(lab, c.lab);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best && bestDist < MAX_DELTA_E) {
      const out = `var(${best.name})`;
      cache.set(normalized, out);
      return out;
    }
    cache.set(normalized, rawHex);
    return rawHex;
  }

  // forEach over NodeList instead of for-of: the `dom` lib in older
  // TS configs treats NodeListOf as not directly iterable.
  doc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const styleAttr = el.getAttribute("style");
    if (!styleAttr) return;
    const rewritten = rewriteHexInStyle(styleAttr, resolveHex);
    if (rewritten !== styleAttr) el.setAttribute("style", rewritten);
  });
}

function buildCandidates(tokens: Record<string, string>): Candidate[] {
  // Active theme tokens take precedence — a user on a custom theme
  // probably wants their own colors mapped, not the seeded defaults.
  // Build the active set first, then layer the well-known palette
  // for any hex the active theme didn't claim.
  const claimed = new Set<string>();
  const out: Candidate[] = [];

  for (const name of REWRITEABLE_KEYS) {
    const value =
      tokens[name] ??
      LEGACY_ALIASES[name]?.map((k) => tokens[k]).find((v) => v !== undefined);
    if (!value) continue;
    const hex = normalizeHex(value);
    if (!hex) continue;
    if (claimed.has(hex)) continue;
    const lab = hexToLab(hex);
    if (!lab) continue;
    out.push({ name, hex, lab });
    claimed.add(hex);
  }

  for (const [hex, name] of Object.entries(WELL_KNOWN_HEXES)) {
    if (claimed.has(hex)) continue;
    const lab = hexToLab(hex);
    if (!lab) continue;
    out.push({ name, hex, lab });
    claimed.add(hex);
  }

  return out;
}

// Normalize `#abc` / `#aabbcc` / `aabbcc` → lowercase 6-char form,
// or null if the input isn't a recognizable hex. rgb()/rgba() and
// keywords return null and get skipped (still left alone in the
// HTML — we just don't try to rewrite them).
function normalizeHex(value: string): string | null {
  const trimmed = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(trimmed)) return `#${trimmed}`;
  if (/^[0-9a-f]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

// sRGB hex → CIELAB. Using D65 illuminant + sRGB gamma curve, the
// standard for web colors. Used only for ΔE76 distance, not for
// display, so we don't need to round-trip with absolute precision.
function hexToLab(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;

  // sRGB → linear
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = lin(r);
  const lg = lin(g);
  const lb = lin(b);

  // Linear RGB → XYZ (D65)
  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const z = lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041;

  // XYZ → Lab (D65 reference white)
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE76(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}
