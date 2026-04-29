// Curated font list for the visual theme builder. Each entry maps to
// either the system font stack (no Google Fonts fetch) or a Google
// Fonts family — the builder emits an `@import url(...)` at the top
// of the theme CSS for any picked Google family so the iframe + the
// puppeteer renderer both fetch the file at render time.
//
// Adding a font: pick a sensible weight set (400/500/600/700 covers
// most layouts), confirm the family is on Google Fonts, and add the
// entry below. The CSS stack should always include a system fallback
// so renders don't blank out if the network is slow.

export interface FontOption {
  // What the dropdown shows.
  label: string;
  // The full CSS value the token gets set to (`'Family', fallbacks, sans-serif`).
  // Picked separately from `family` because the fallback stack varies
  // — system fonts have no quoted family.
  value: string;
  // The bare family name (no quotes, no fallbacks). null for "System"
  // since it has no canonical family — used to skip the Google Fonts
  // import for system-only options.
  family: string | null;
  // Google Fonts URL that loads the family at the listed weights.
  // null for system / fonts not on Google Fonts. Builder concatenates
  // the URLs of every picked family into a single @import block.
  googleFontsUrl: string | null;
}

const SYSTEM_SANS_FALLBACKS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const SYSTEM_MONO_FALLBACKS =
  "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

function googleFontsUrl(family: string, weights: number[]): string {
  const escaped = family.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${escaped}:wght@${weights.join(";")}&display=swap`;
}

// Sans-serif options. "System" is the safe default — fastest, no
// network. The rest are common in product / editorial design.
export const SANS_FONTS: FontOption[] = [
  {
    label: "System",
    value: SYSTEM_SANS_FALLBACKS,
    family: null,
    googleFontsUrl: null,
  },
  ...[
    "Inter",
    "Figtree",
    "Manrope",
    "Sora",
    "Space Grotesk",
    "Plus Jakarta Sans",
    "IBM Plex Sans",
    "Outfit",
    "Geist",
    "DM Sans",
    "Lato",
  ].map(
    (family): FontOption => ({
      label: family,
      value: `'${family}', ${SYSTEM_SANS_FALLBACKS}`,
      family,
      googleFontsUrl: googleFontsUrl(family, [400, 500, 600, 700]),
    }),
  ),
];

// Mono / monospace options. Used for numeric readouts + code-style
// labels (KPI value alignment, timestamps).
export const MONO_FONTS: FontOption[] = [
  {
    label: "System mono",
    value: SYSTEM_MONO_FALLBACKS,
    family: null,
    googleFontsUrl: null,
  },
  ...[
    { family: "JetBrains Mono", weights: [400, 500, 600] },
    { family: "IBM Plex Mono", weights: [400, 500, 600] },
    { family: "Space Mono", weights: [400, 700] },
    { family: "Geist Mono", weights: [400, 500, 600] },
    { family: "Roboto Mono", weights: [400, 500, 600] },
  ].map(
    ({ family, weights }): FontOption => ({
      label: family,
      value: `'${family}', ${SYSTEM_MONO_FALLBACKS}`,
      family,
      googleFontsUrl: googleFontsUrl(family, weights),
    }),
  ),
];

// Reverse lookup: given a CSS font value (which might have whitespace
// quirks or legacy fallbacks), find the matching curated option.
// Used when re-opening an existing theme to populate the dropdown.
// Falls back to the family name appearing as the first quoted family.
export function matchFontOption(
  value: string | undefined,
  options: FontOption[],
): FontOption | null {
  if (!value) return null;
  const normalized = value.trim();
  const direct = options.find((o) => o.value === normalized);
  if (direct) return direct;
  // Match by first quoted family name — handles minor fallback
  // variations a user might paste in.
  const firstFamily = normalized.match(/['"]([^'"]+)['"]/)?.[1];
  if (firstFamily) {
    const byFamily = options.find((o) => o.family === firstFamily);
    if (byFamily) return byFamily;
  }
  // System stack: no quoted family but starts with -apple-system / ui-monospace.
  if (/^(?:-apple-system|ui-monospace)/i.test(normalized)) {
    return options[0];
  }
  return null;
}
