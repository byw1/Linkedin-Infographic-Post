"use client";

import { useEffect, useState } from "react";
import type { ThemeDiagnostics } from "@/components/slide-preview";

export interface PickerTheme {
  id: string;
  name: string;
  isOfficial: boolean;
  isMine: boolean;
  fontFamily: string | null;
  tokens: Record<string, string>;
}

// Full theme content (including raw CSS). Loaded on demand for the
// active theme so the picker doesn't ship every theme's CSS up front.
export interface ActiveTheme extends PickerTheme {
  css: string;
}

const STORAGE_KEY = "viral.activeThemeId";

export function getStoredThemeId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredThemeId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(STORAGE_KEY, id);
  else window.localStorage.removeItem(STORAGE_KEY);
}

interface Props {
  // Fired whenever the active theme changes (including the initial
  // load). Receives the loaded ActiveTheme (with `css`) or `null` if
  // the user picks "no theme".
  onChange: (theme: ActiveTheme | null) => void;
  // Latest theme diagnostics from the editor's preview iframe. When
  // provided, the dropdown shows a "Currently rendering" panel with
  // body font, background, accent rewrite count, and chart count —
  // so the user can spot "fonts didn't load" or "no rewrites fired"
  // at a glance instead of opening devtools.
  diagnostics?: ThemeDiagnostics | null;
}

// Compact dropdown: shows the active theme name + a small color chip.
// Used in both editor toolbars. Selection is persisted client-side
// only — server doesn't track "active theme per user", just records
// which theme each render used.
export function ThemePicker({ onChange, diagnostics }: Props) {
  const [list, setList] = useState<PickerTheme[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Initial load — fetch the picker list, restore the stored selection
  // (or fall back to the first official theme), then resolve the full
  // theme so the parent can inject CSS.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/themes");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      const items = data.themes as PickerTheme[];
      if (cancelled) return;
      setList(items);

      const stored = getStoredThemeId();
      const preferred =
        items.find((t) => t.id === stored) ??
        items.find((t) => t.isOfficial) ??
        items[0] ??
        null;
      const nextId = preferred?.id ?? null;
      setActiveId(nextId);
      if (nextId) {
        const full = await fetchActiveTheme(nextId);
        if (full && !cancelled) onChange(full);
      } else {
        onChange(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // onChange is stable per parent; tracking it in deps would refire
    // the load whenever the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(id: string | null) {
    setActiveId(id);
    setStoredThemeId(id);
    setOpen(false);
    if (!id) {
      onChange(null);
      return;
    }
    const full = await fetchActiveTheme(id);
    if (full) onChange(full);
  }

  const active = list?.find((t) => t.id === activeId) ?? null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
        title="Pick a theme"
      >
        <span
          className="h-3 w-3 rounded-full border"
          style={{ background: active ? swatchAccent(active.tokens) : "transparent" }}
        />
        <span className="max-w-[10rem] truncate">{active?.name ?? "Pick a theme"}</span>
        <span aria-hidden className="text-muted-foreground">
          ▾
        </span>
      </button>

      {open && list && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-md border bg-card p-1 text-card-foreground shadow-md">
          {list.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void pick(t.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-secondary ${
                activeId === t.id ? "bg-secondary" : ""
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border"
                  style={{ background: swatchAccent(t.tokens) }}
                />
                <span className="truncate">{t.name}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                {t.isOfficial && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                    Official
                  </span>
                )}
                {t.isMine && !t.isOfficial && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-secondary-foreground">
                    Mine
                  </span>
                )}
              </span>
            </button>
          ))}
          {diagnostics && active && (
            <DiagnosticsPanel d={diagnostics} theme={active} />
          )}
          <div className="my-1 border-t" />
          <a
            href="/settings/themes"
            className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:text-foreground"
          >
            Manage themes →
          </a>
        </div>
      )}
    </div>
  );
}

// Family names the browser/OS treat as interchangeable when picking
// a system UI font. If the theme stack starts with one of these and
// body renders with another, it's not a real mismatch — both are
// "the system font" and the row should stay green.
const SYSTEM_FAMILY_KEYWORDS = new Set(
  [
    "system-ui",
    "-apple-system",
    "blinkmacsystemfont",
    "segoe ui",
    "ui-sans-serif",
    "sans-serif",
    "helvetica neue",
    "helvetica",
    "arial",
  ].map((s) => s.toLowerCase()),
);

function normalizeFamily(name: string): string {
  return name
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
}

function isSystemFamily(name: string | null): boolean {
  if (!name) return false;
  return SYSTEM_FAMILY_KEYWORDS.has(normalizeFamily(name));
}

// First family in a comma-separated font stack, whether quoted or
// not. `font-family: -apple-system, …, 'Segoe UI', …` should report
// `-apple-system`, not the first quoted name three slots in.
function firstFamilyOf(stack: string | null | undefined): string | null {
  if (!stack) return null;
  const first = stack.split(",")[0]?.trim();
  if (!first) return null;
  return first.replace(/^['"]|['"]$/g, "") || null;
}

// Compact "Currently rendering" panel inside the picker dropdown.
// Pairs what the *theme declares* with what's *actually rendering*
// so a real mismatch (e.g. theme says 'Figtree' but body shows
// 'system-ui') is obvious without opening devtools. Rows go red
// only on real mismatches — system-stack fonts (-apple-system /
// system-ui / Segoe UI / etc.) are treated as equivalent so a
// theme using the system stack doesn't get a false-positive red
// flag against the browser's normalized rendering keyword.
function DiagnosticsPanel({
  d,
  theme,
}: {
  d: ThemeDiagnostics;
  theme: PickerTheme;
}) {
  // What the theme is asking for. Read both naming conventions so
  // pasted themes using --font-sans show up too.
  const declaredFontStack =
    theme.tokens["--font-family-base"] ?? theme.tokens["--font-sans"] ?? null;
  const declaredFirstFamily = firstFamilyOf(declaredFontStack);

  const fontNotLoaded = d.fontFamily && d.fontLoaded === false;
  // Mismatch flags only when the theme and body resolve to different
  // *actual* families. If both are system-stack keywords, they're
  // equivalent — both render with the OS UI font. Same hex test
  // ignores case so 'segoe ui' vs 'Segoe UI' doesn't trip.
  const fontMismatch =
    declaredFirstFamily &&
    d.fontFamily &&
    normalizeFamily(declaredFirstFamily) !== normalizeFamily(d.fontFamily) &&
    !(isSystemFamily(declaredFirstFamily) && isSystemFamily(d.fontFamily));
  const noRewrites = d.inlineStyledElements > 0 && d.tokenizedElements === 0;

  // Trim the raw stack to ~3 families so the row stays one line in
  // the dropdown. The full string is on the title attribute for
  // hover-to-reveal.
  const compactStack = d.fontFamilyRaw
    ? d.fontFamilyRaw
        .split(",")
        .slice(0, 3)
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .join(", ") + (d.fontFamilyRaw.split(",").length > 3 ? ", …" : "")
    : "—";

  // The injection chain has three failure points: the <link> element
  // never gets added, the :root --font-family-base never resolves,
  // and the body rule never wins the cascade. The three diagnostic
  // rows below (Loader, Token, Body) map one-to-one to those steps,
  // so the broken row is the one to fix.
  const noLinks = d.themeLinks === 0;
  const tokenMissing = !d.rootFontFamilyVar;
  return (
    <>
      <div className="my-1 border-t" />
      <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
        Currently rendering
      </div>
      <div className="space-y-0.5 px-2 pb-2 text-[11px]">
        {declaredFirstFamily && (
          <DiagnosticRow
            label="Theme font"
            value={declaredFirstFamily}
          />
        )}
        <DiagnosticRow
          label="Loader links"
          value={`${d.themeLinks} <link>${d.themeLinks === 1 ? "" : "s"}`}
          flag={noLinks && Boolean(declaredFirstFamily)}
        />
        <DiagnosticRow
          label="Root token"
          value={
            d.rootFontFamilyVar
              ? firstFamilyOf(d.rootFontFamilyVar) ?? "(empty)"
              : "(unset)"
          }
          flag={tokenMissing && Boolean(declaredFirstFamily)}
        />
        <DiagnosticRow
          label="Body uses"
          value={compactStack}
          flag={Boolean(fontNotLoaded || fontMismatch)}
          fullValue={d.fontFamilyRaw}
        />
        <DiagnosticRow
          label="Loaded?"
          value={
            d.fontFamily
              ? `${d.fontFamily}${d.fontLoaded === false ? " · not loaded" : d.fontLoaded ? " ✓" : ""}`
              : "—"
          }
          flag={Boolean(fontNotLoaded)}
        />
        <DiagnosticRow label="Background" value={d.backgroundColor || "—"} />
        <DiagnosticRow label="Text color" value={d.color || "—"} />
        <DiagnosticRow
          label="Token usages"
          value={`${d.tokenizedElements} / ${d.inlineStyledElements} styled`}
          flag={noRewrites}
        />
        <DiagnosticRow
          label="Charts"
          value={d.canvases === 0 ? "none" : `${d.canvases} found`}
        />
      </div>
    </>
  );
}

function DiagnosticRow({
  label,
  value,
  flag,
  fullValue,
}: {
  label: string;
  value: string;
  flag?: boolean;
  // Optional longer string to expose on hover. Defaults to `value`
  // so simple rows still get a readable tooltip when truncated.
  fullValue?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`truncate font-mono ${flag ? "text-destructive" : "text-foreground"}`}
        title={fullValue ?? value}
      >
        {value}
      </span>
    </div>
  );
}

// Read a token from the parsed map, falling back through the legacy
// alias if a pasted theme uses the older naming. Mirrors getToken()
// in lib/themes.ts but stays client-safe.
function swatchAccent(tokens: Record<string, string>): string {
  return (
    tokens["--color-accent-primary"] ??
    tokens["--accent"] ??
    "transparent"
  );
}

async function fetchActiveTheme(id: string): Promise<ActiveTheme | null> {
  const res = await fetch(`/api/themes/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  const t = data.theme;
  return {
    id: t.id,
    name: t.name,
    isOfficial: t.isOfficial,
    isMine: false, // unused after load
    fontFamily: t.fontFamily,
    tokens: (t.tokens ?? {}) as Record<string, string>,
    css: t.css,
  };
}
