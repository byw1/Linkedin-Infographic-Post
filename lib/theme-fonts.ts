// Pasted themes (the CSS tab) don't always remember to load the
// Google Fonts they reference — a user might set
// `--font-family-base: 'Figtree', -apple-system, …` without adding
// `@import url('https://fonts.googleapis.com/css2?family=Figtree…')`
// at the top, so the browser silently falls through to the system
// font and the theme appears to do nothing for typography.
//
// At injection time we sniff the theme for known Google Fonts
// families and prepend the missing imports. The visual builder
// already does this on save, so re-saving a theme through the form
// is also a way to fix legacy pasted themes — but injection-time
// guarantees correctness regardless of how the theme was authored.
//
// Pure data + pure functions; safe to import from both client
// components and the worker.

interface FontUrl {
  family: string;
  url: string;
}

// Curated list mirrors components/themes/font-options.ts. Add a
// family here only if Google Fonts hosts it under that exact name —
// otherwise the import 404s and the browser logs noise. Weights
// match the visual builder's defaults so the same import URL is
// emitted in both paths (cache hits in the browser).
const GOOGLE_FONTS: FontUrl[] = [
  { family: "Inter", url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
  { family: "Figtree", url: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" },
  { family: "Manrope", url: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" },
  { family: "Sora", url: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap" },
  { family: "Space Grotesk", url: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" },
  { family: "Plus Jakarta Sans", url: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" },
  { family: "IBM Plex Sans", url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" },
  { family: "Outfit", url: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" },
  { family: "Geist", url: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" },
  { family: "DM Sans", url: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" },
  { family: "Lato", url: "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" },
  { family: "JetBrains Mono", url: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" },
  { family: "IBM Plex Mono", url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" },
  { family: "Space Mono", url: "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" },
  { family: "Geist Mono", url: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&display=swap" },
  { family: "Roboto Mono", url: "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600&display=swap" },
];

const FAMILY_TO_URL = new Map(GOOGLE_FONTS.map((f) => [f.family, f.url]));

// Returns the input CSS with Google Fonts `@import` lines prepended
// for any quoted family the theme references that's on our curated
// list and isn't already imported. Idempotent — safe to call twice.
//
// Detection is intentionally narrow: we only look at the first
// quoted family in each `--font-family-*` / `--font-*` declaration
// (the user's preferred face) and only auto-import if we have a URL
// for it. Fallback families in the stack are left to the browser's
// font-fallback chain; we never auto-import those.
export function ensureFontImports(css: string): string {
  const missing = extractGoogleFontUrls(css);
  if (missing.length === 0) return css;
  const lines = missing.map((u) => `@import url('${u}');`).join("\n");
  return `${lines}\n${css}`;
}

// Same detection logic as ensureFontImports but returns just the
// URLs the caller should fetch — used by client-side iframe
// injection, which inserts real `<link rel="stylesheet">` elements
// instead of `@import` lines. <link> is more reliable than dynamic
// @import for browsers parsing styles added post-load, and it lets
// the browser show "loaded" / "errored" status correctly in devtools.
export function extractGoogleFontUrls(css: string): string[] {
  const families = collectReferencedFamilies(css);
  if (families.size === 0) return [];
  const importsAlreadyPresent = collectImportedFamilies(css);
  const out: string[] = [];
  for (const family of families) {
    if (importsAlreadyPresent.has(family)) continue;
    const url = FAMILY_TO_URL.get(family);
    if (!url) continue;
    out.push(url);
  }
  return out;
}

// Canonical ↔ legacy token pairs. Each entry is one canonical name
// and one legacy alias for the same role; emitted both ways at
// injection time so source HTML using either convention picks up
// the user's theme value.
const ALIAS_PAIRS: Array<[canonical: string, legacy: string]> = [
  ["--color-background-primary", "--bg-canvas"],
  ["--color-background-secondary", "--bg-panel"],
  ["--color-background-tertiary", "--bg-panel-raised"],
  ["--color-text-primary", "--fg-primary"],
  ["--color-text-secondary", "--fg-secondary"],
  ["--color-text-tertiary", "--fg-tertiary"],
  ["--color-text-tertiary", "--fg-muted"],
  ["--color-text-on-accent", "--fg-on-accent"],
  ["--color-border-primary", "--edge-strong"],
  ["--color-border-tertiary", "--edge-hairline"],
  ["--color-accent-primary", "--accent"],
  ["--color-accent-secondary", "--accent-hover"],
  ["--color-signal-success", "--signal-success"],
  ["--color-signal-warn", "--signal-warn"],
  ["--color-signal-warn", "--signal"],
  ["--color-signal-error", "--signal-error"],
  ["--font-family-base", "--font-sans"],
  ["--font-family-display", "--font-display"],
  ["--font-family-mono", "--font-mono"],
];

// Build a `:root { … }` block that mirrors every defined token
// across canonical/legacy names. Without this, source HTML that
// references `var(--color-background-primary)` doesn't pick up a
// theme that defines `--bg-canvas` (and vice versa) — the source's
// own `:root` definition shadows the fallback chain in our
// `!important` overrides.
//
// Strategy: for each (canonical, legacy) pair, if the theme has one
// side defined, emit the other side with the same value. If the
// theme has both, leave them alone (the user's intent is explicit).
// Multiple legacy aliases for the same canonical (e.g. `--fg-muted`
// + `--fg-tertiary` both map to `--color-text-tertiary`) all get
// the canonical's value.
export function buildAliasBridge(tokens: Record<string, string>): string {
  const additions: Array<[string, string]> = [];

  for (const [canonical, legacy] of ALIAS_PAIRS) {
    const canon = tokens[canonical];
    const leg = tokens[legacy];
    if (canon && !leg) {
      additions.push([legacy, canon]);
    } else if (leg && !canon) {
      additions.push([canonical, leg]);
    }
  }

  if (additions.length === 0) return "";

  // Deduplicate — multiple legacy aliases mapping to the same
  // canonical only need to emit the canonical once.
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const [name, value] of additions) {
    if (seen.has(name)) continue;
    seen.add(name);
    lines.push(`  ${name}: ${value};`);
  }
  return `:root {\n${lines.join("\n")}\n}`;
}

// Pull the first quoted family name out of every `--font-*: …`
// declaration. We only act on the first family because the others
// are fallbacks; we don't want to fetch system fonts pretending to
// be Google ones, etc.
function collectReferencedFamilies(css: string): Set<string> {
  const out = new Set<string>();
  // Match `--font-…: <value>;` — value runs until the first `;`,
  // newline, or closing brace. Captures the rest of the declaration
  // so we can pull the first quoted family out of it.
  const declRe = /--font-[\w-]+\s*:\s*([^;}\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(css)) !== null) {
    const firstQuoted = m[1].match(/['"]([^'"]+)['"]/);
    if (firstQuoted) out.add(firstQuoted[1]);
  }
  return out;
}

// Pull the family name out of any existing `@import url('…?family=X…')`
// so we don't double-import. Tolerates either single or double quotes
// on the URL and either `+` or `%20` URL-encoded spaces in the family.
function collectImportedFamilies(css: string): Set<string> {
  const out = new Set<string>();
  const importRe = /@import\s+url\(\s*['"]?[^'")]*?\?family=([^&'")]+)[^)]*\)/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(css)) !== null) {
    const raw = m[1];
    const family = decodeURIComponent(raw.replace(/\+/g, " ")).split(":")[0];
    out.add(family);
  }
  return out;
}
