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
        className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs hover:bg-secondary"
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
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary">
                    Official
                  </span>
                )}
                {t.isMine && !t.isOfficial && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-secondary-foreground">
                    Mine
                  </span>
                )}
              </span>
            </button>
          ))}
          {diagnostics && <DiagnosticsPanel d={diagnostics} />}
          <div className="my-1 border-t" />
          <a
            href="/settings#themes"
            className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Manage themes →
          </a>
        </div>
      )}
    </div>
  );
}

// Compact "Currently rendering" panel inside the picker dropdown.
// Each row exposes one signal the user can spot-check without
// opening devtools: body font (+ load status), body background, how
// many inline styles got rewritten to var(--…), how many charts
// were detected. A row glows red when its value is suspicious
// (font not loaded, zero rewrites despite having styled elements,
// etc.) so the eye lands there first.
function DiagnosticsPanel({ d }: { d: ThemeDiagnostics }) {
  const fontIssue = d.fontFamily && d.fontLoaded === false;
  const noRewrites = d.inlineStyledElements > 0 && d.tokenizedElements === 0;
  return (
    <>
      <div className="my-1 border-t" />
      <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Currently rendering
      </div>
      <div className="space-y-0.5 px-2 pb-2 text-[11px]">
        <DiagnosticRow
          label="Font"
          value={
            d.fontFamily
              ? `${d.fontFamily}${d.fontLoaded === false ? " · not loaded" : d.fontLoaded ? " ✓" : ""}`
              : "—"
          }
          flag={Boolean(fontIssue)}
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
}: {
  label: string;
  value: string;
  flag?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`truncate font-mono ${flag ? "text-destructive" : "text-foreground"}`}
        title={value}
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
