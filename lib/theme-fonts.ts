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
  const families = collectReferencedFamilies(css);
  if (families.size === 0) return css;

  const importsAlreadyPresent = collectImportedFamilies(css);
  const missing: string[] = [];
  for (const family of families) {
    if (importsAlreadyPresent.has(family)) continue;
    const url = FAMILY_TO_URL.get(family);
    if (!url) continue;
    missing.push(url);
  }
  if (missing.length === 0) return css;

  const lines = missing.map((u) => `@import url('${u}');`).join("\n");
  return `${lines}\n${css}`;
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
