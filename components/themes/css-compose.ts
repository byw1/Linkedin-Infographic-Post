// Pure helpers for translating between the visual builder's form
// fields and the raw CSS the API stores. No React, no DOM — safe to
// import from any client component.
//
// CSS is the source of truth in the database. The form fields are a
// projection: when a theme is opened for editing, we parse the CSS
// to populate the form; when the user edits a field, we re-emit the
// CSS from the form. Round-tripping a visually-built theme through
// parse → compose → parse should yield the same tokens back.
//
// We support two naming conventions because user-pasted themes use
// either the canonical `--color-*` names or the older `--bg-*` /
// `--fg-*` / `--accent` shorthand. Parsing accepts both; emission
// always writes canonical names so re-saving normalizes legacy CSS.

export interface ThemeFormValues {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;

  borderPrimary: string;
  borderSecondary: string;
  borderTertiary: string;

  accentPrimary: string;
  accentSecondary: string;
  accentSoft: string;
  accentText: string;

  signalSuccess: string;
  signalWarn: string;
  signalError: string;

  // Stored as the full CSS font-family value (`'Inter', fallbacks…`).
  fontBase: string;
  fontDisplay: string;
  fontMono: string;

  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
}

// Each form field maps to a canonical token, plus a list of legacy
// aliases the parser will accept when populating from existing CSS.
const FIELD_MAP: { field: keyof ThemeFormValues; canonical: string; legacy: string[] }[] = [
  { field: "bgPrimary",      canonical: "--color-background-primary",   legacy: ["--bg-canvas"] },
  { field: "bgSecondary",    canonical: "--color-background-secondary", legacy: ["--bg-panel"] },
  { field: "bgTertiary",     canonical: "--color-background-tertiary",  legacy: ["--bg-panel-raised"] },
  { field: "textPrimary",    canonical: "--color-text-primary",         legacy: ["--fg-primary"] },
  { field: "textSecondary",  canonical: "--color-text-secondary",       legacy: ["--fg-secondary"] },
  { field: "textTertiary",   canonical: "--color-text-tertiary",        legacy: ["--fg-tertiary", "--fg-muted"] },
  { field: "textOnAccent",   canonical: "--color-text-on-accent",       legacy: ["--fg-on-accent"] },
  { field: "borderPrimary",  canonical: "--color-border-primary",       legacy: ["--edge-strong"] },
  { field: "borderSecondary", canonical: "--color-border-secondary",    legacy: [] },
  { field: "borderTertiary", canonical: "--color-border-tertiary",      legacy: ["--edge-hairline"] },
  { field: "accentPrimary",  canonical: "--color-accent-primary",       legacy: ["--accent"] },
  { field: "accentSecondary", canonical: "--color-accent-secondary",    legacy: ["--accent-hover"] },
  { field: "accentSoft",     canonical: "--color-accent-soft",          legacy: [] },
  { field: "accentText",     canonical: "--color-accent-text",          legacy: [] },
  { field: "signalSuccess",  canonical: "--color-signal-success",       legacy: ["--signal-success"] },
  { field: "signalWarn",     canonical: "--color-signal-warn",          legacy: ["--signal-warn", "--signal"] },
  { field: "signalError",    canonical: "--color-signal-error",         legacy: ["--signal-error"] },
  { field: "fontBase",       canonical: "--font-family-base",           legacy: ["--font-sans"] },
  { field: "fontDisplay",    canonical: "--font-family-display",        legacy: ["--font-display"] },
  { field: "fontMono",       canonical: "--font-family-mono",           legacy: ["--font-mono"] },
  { field: "radiusSm",       canonical: "--border-radius-sm",           legacy: [] },
  { field: "radiusMd",       canonical: "--border-radius-md",           legacy: [] },
  { field: "radiusLg",       canonical: "--border-radius-lg",           legacy: [] },
];

export const DEFAULT_FORM: ThemeFormValues = {
  bgPrimary: "#FFFFFF",
  bgSecondary: "#F5F5F4",
  bgTertiary: "#EBEBE9",
  textPrimary: "#1A1A1A",
  textSecondary: "#555555",
  textTertiary: "#888888",
  textOnAccent: "#FFFFFF",
  borderPrimary: "rgba(0,0,0,0.18)",
  borderSecondary: "rgba(0,0,0,0.12)",
  borderTertiary: "rgba(0,0,0,0.06)",
  accentPrimary: "#534AB7",
  accentSecondary: "#AFA9EC",
  accentSoft: "#EEEDFE",
  accentText: "#26215C",
  signalSuccess: "#00C853",
  signalWarn: "#F59E0B",
  signalError: "#DC2626",
  fontBase: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  fontDisplay: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  fontMono: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
  radiusSm: "6px",
  radiusMd: "10px",
  radiusLg: "16px",
};

// Pull every `--key: value;` declaration out of arbitrary CSS. Same
// regex shape lib/themes.ts uses on the server — kept in sync.
function parseAllTokens(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[a-zA-Z][\w-]*)\s*:\s*([^;}\n]+)\s*[;}\n]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

// Populate the form from an existing CSS string. Returns the merged
// values + a `coverage` count so the caller can warn the user when
// the visual form can't fully represent what's in the CSS (suggesting
// they edit on the CSS tab instead).
export function formFromCss(css: string): {
  values: ThemeFormValues;
  coverage: number; // fields populated by the parse, 0 = nothing matched
} {
  const tokens = parseAllTokens(css);
  const values: ThemeFormValues = { ...DEFAULT_FORM };
  let coverage = 0;
  for (const { field, canonical, legacy } of FIELD_MAP) {
    const found =
      tokens[canonical] ??
      legacy.map((k) => tokens[k]).find((v) => v !== undefined);
    if (found !== undefined) {
      values[field] = found;
      coverage += 1;
    }
  }
  return { values, coverage };
}

// Compose the final CSS the API stores. Includes any picked Google
// Fonts URLs as `@import` declarations so the family is fetched
// when the theme is injected. Output is human-readable so a user
// who later opens the CSS tab can still understand the theme.
export function composeCss(
  values: ThemeFormValues,
  googleFontsUrls: string[] = [],
): string {
  const importLines = googleFontsUrls
    .filter((u) => u && /^https?:\/\//.test(u))
    .map((u) => `@import url('${u}');`)
    .join("\n");

  const tokenLines = FIELD_MAP.map(({ field, canonical }) => {
    const v = values[field];
    return `  ${canonical}: ${v};`;
  }).join("\n");

  const rootBlock = `:root, [data-theme="custom"] {\n${tokenLines}\n}`;
  return [importLines, rootBlock].filter(Boolean).join("\n\n") + "\n";
}
