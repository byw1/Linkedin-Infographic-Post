"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  composeCss,
  DEFAULT_FORM,
  formFromCss,
  type ThemeFormValues,
} from "@/components/themes/css-compose";
import {
  matchFontOption,
  MONO_FONTS,
  SANS_FONTS,
  type FontOption,
} from "@/components/themes/font-options";
import { PRESETS } from "@/components/themes/presets";
import { SampleSlide } from "@/components/themes/sample-slide";

interface ExistingTheme {
  id: string;
  name: string;
}

interface Props {
  mode: "member" | "admin";
  existing?: ExistingTheme;
  onCancel: () => void;
  onSaved: () => void;
}

type Tab = "visual" | "css";

// Tabbed theme editor. Default tab is Visual — color pickers and a
// font dropdown for the 22 editable tokens, with a live sample slide
// next to the form. CSS tab is the same textarea power users had
// before. The two tabs share a single source of truth (`css` state);
// switching from Visual → CSS regenerates CSS from the form, and
// switching from CSS → Visual re-parses the textarea into form
// fields. Saves whichever tab was last active.
export function ThemeForm({ mode, existing, onCancel, onSaved }: Props) {
  const isEdit = Boolean(existing);
  const [tab, setTab] = useState<Tab>("visual");
  const [name, setName] = useState(existing?.name ?? "");
  const [values, setValues] = useState<ThemeFormValues>(DEFAULT_FORM);
  const [rawCss, setRawCss] = useState<string>(composeCss(DEFAULT_FORM));
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Editing: load the existing CSS lazily, populate form fields. If
  // the parse covers fewer than half the form's fields, default to
  // the CSS tab — the theme isn't a clean fit for the visual builder
  // (probably hand-written with custom comments / unknown tokens).
  useEffect(() => {
    if (!existing) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/themes/${existing.id}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      const css = data.theme.css as string;
      const { values: parsed, coverage } = formFromCss(css);
      setValues(parsed);
      setRawCss(css);
      // 11 = half of the 22 editable fields. Below that we assume the
      // CSS has structure the visual form would lose on round-trip,
      // so we open the CSS tab to make the source visible.
      if (coverage < 11) setTab("css");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [existing]);

  // Visual tab is authoritative when it's active: every field change
  // recomputes the CSS. Switching to CSS hands that CSS off as the
  // textarea's starting content; from then on, CSS is authoritative
  // until the user switches back.
  function setField<K extends keyof ThemeFormValues>(field: K, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    setRawCss(composeCss(next, fontUrlsFor(next)));
  }

  function switchTab(next: Tab) {
    if (next === tab) return;
    if (next === "css") {
      // Visual → CSS: ensure the textarea reflects the latest form.
      setRawCss(composeCss(values, fontUrlsFor(values)));
    } else {
      // CSS → Visual: re-parse the textarea so the form catches up.
      const { values: parsed } = formFromCss(rawCss);
      setValues(parsed);
    }
    setTab(next);
  }

  // Whichever tab is active is the source on save. Visual emits a
  // composed CSS; CSS sends the textarea verbatim.
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cssToSave =
      tab === "visual" ? composeCss(values, fontUrlsFor(values)) : rawCss;
    startSubmit(async () => {
      const url = isEdit
        ? `/api/themes/${existing!.id}`
        : mode === "admin"
          ? "/api/admin/themes"
          : "/api/themes";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { name, css: cssToSave }
        : mode === "admin"
          ? { name, css: cssToSave, isOfficial: true }
          : { name, css: cssToSave };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      onSaved();
    });
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Loading theme…
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            {isEdit ? `Edit "${existing!.name}"` : "New theme"}
          </h3>
          {!isEdit && mode === "admin" && (
            <p className="text-xs text-muted-foreground">
              Saved as official — visible to everyone.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            <TabButton active={tab === "visual"} onClick={() => switchTab("visual")}>
              Visual
            </TabButton>
            <TabButton active={tab === "css"} onClick={() => switchTab("css")}>
              CSS
            </TabButton>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          placeholder="e.g. Acme — Dark"
          required
        />
      </label>

      {!isEdit && (
        <PresetRow
          onPick={(values) => {
            setValues(values);
            setRawCss(composeCss(values, fontUrlsFor(values)));
          }}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {tab === "visual" ? (
            <VisualBuilder values={values} onChange={setField} />
          ) : (
            <CssEditor
              value={rawCss}
              onChange={setRawCss}
            />
          )}
        </div>
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Live preview
          </span>
          <SampleSlide css={tab === "visual" ? composeCss(values, fontUrlsFor(values)) : rawCss} />
          <p className="text-[11px] text-muted-foreground">
            What the active tokens look like on a sample slide. Edits update
            instantly; Google Fonts load on first use.
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

// Horizontal scroll of starter palettes for the new-theme flow.
// Each card is a thumbnail of canvas + accent + soft-fill swatches
// — enough to recognize at a glance — plus the label and a one-line
// blurb. Clicking one pours the preset's full ThemeFormValues into
// the form (including font choices), discarding any in-progress
// edits without confirmation since this is only shown for new
// themes (edits don't show this row).
function PresetRow({ onPick }: { onPick: (values: ThemeFormValues) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Start from a preset
      </span>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onPick(preset.values)}
            className="group flex w-44 shrink-0 flex-col gap-1.5 rounded-md border bg-background p-2 text-left hover:border-primary"
          >
            <div className="flex h-10 overflow-hidden rounded">
              <div
                className="flex-1"
                style={{ background: preset.values.bgPrimary }}
              />
              <div
                className="flex-1"
                style={{ background: preset.values.bgSecondary }}
              />
              <div
                className="flex-1"
                style={{ background: preset.values.accentSoft }}
              />
              <div
                className="flex-1"
                style={{ background: preset.values.accentPrimary }}
              />
              <div
                className="flex-1"
                style={{ background: preset.values.textPrimary }}
              />
            </div>
            <div
              className="text-xs font-medium leading-tight"
              style={{ fontFamily: preset.values.fontDisplay }}
            >
              {preset.label}
            </div>
            <div className="text-[10px] leading-snug text-muted-foreground">
              {preset.blurb}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm px-2 py-1 font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

interface VisualProps {
  values: ThemeFormValues;
  onChange: <K extends keyof ThemeFormValues>(field: K, value: string) => void;
}

function VisualBuilder({ values, onChange }: VisualProps) {
  return (
    <div className="space-y-5">
      <Section title="Surface">
        <ColorRow
          label="Canvas (page background)"
          value={values.bgPrimary}
          onChange={(v) => onChange("bgPrimary", v)}
        />
        <ColorRow
          label="Panel (cards, KPI bg)"
          value={values.bgSecondary}
          onChange={(v) => onChange("bgSecondary", v)}
        />
        <ColorRow
          label="Raised (panels-on-panels)"
          value={values.bgTertiary}
          onChange={(v) => onChange("bgTertiary", v)}
        />
      </Section>

      <Section title="Text">
        <ColorRow
          label="Primary (body / title)"
          value={values.textPrimary}
          onChange={(v) => onChange("textPrimary", v)}
        />
        <ColorRow
          label="Secondary (sub-copy)"
          value={values.textSecondary}
          onChange={(v) => onChange("textSecondary", v)}
        />
        <ColorRow
          label="Tertiary (captions, credits)"
          value={values.textTertiary}
          onChange={(v) => onChange("textTertiary", v)}
        />
        <ColorRow
          label="On accent (text on accent fill)"
          value={values.textOnAccent}
          onChange={(v) => onChange("textOnAccent", v)}
        />
      </Section>

      <Section title="Border">
        <ColorRow
          label="Strong"
          value={values.borderPrimary}
          onChange={(v) => onChange("borderPrimary", v)}
        />
        <ColorRow
          label="Soft"
          value={values.borderSecondary}
          onChange={(v) => onChange("borderSecondary", v)}
        />
        <ColorRow
          label="Hairline"
          value={values.borderTertiary}
          onChange={(v) => onChange("borderTertiary", v)}
        />
      </Section>

      <Section title="Accent">
        <ColorRow
          label="Primary (brand)"
          value={values.accentPrimary}
          onChange={(v) => onChange("accentPrimary", v)}
        />
        <ColorRow
          label="Secondary (lighter highlights)"
          value={values.accentSecondary}
          onChange={(v) => onChange("accentSecondary", v)}
        />
        <ColorRow
          label="Soft (KPI / tag fill)"
          value={values.accentSoft}
          onChange={(v) => onChange("accentSoft", v)}
        />
        <ColorRow
          label="Text (on accent-soft fill)"
          value={values.accentText}
          onChange={(v) => onChange("accentText", v)}
        />
      </Section>

      <Section title="Signal">
        <ColorRow
          label="Success"
          value={values.signalSuccess}
          onChange={(v) => onChange("signalSuccess", v)}
        />
        <ColorRow
          label="Warn"
          value={values.signalWarn}
          onChange={(v) => onChange("signalWarn", v)}
        />
        <ColorRow
          label="Error"
          value={values.signalError}
          onChange={(v) => onChange("signalError", v)}
        />
      </Section>

      <Section title="Typography">
        <FontRow
          label="Body"
          value={values.fontBase}
          options={SANS_FONTS}
          onChange={(v) => onChange("fontBase", v)}
        />
        <FontRow
          label="Display (titles)"
          value={values.fontDisplay}
          options={SANS_FONTS}
          onChange={(v) => onChange("fontDisplay", v)}
        />
        <FontRow
          label="Mono (numerics)"
          value={values.fontMono}
          options={MONO_FONTS}
          onChange={(v) => onChange("fontMono", v)}
        />
      </Section>

      <Section title="Radius">
        <RadiusRow
          label="Small (buttons)"
          value={values.radiusSm}
          onChange={(v) => onChange("radiusSm", v)}
        />
        <RadiusRow
          label="Medium (cards)"
          value={values.radiusMd}
          onChange={(v) => onChange("radiusMd", v)}
        />
        <RadiusRow
          label="Large (panels)"
          value={values.radiusLg}
          onChange={(v) => onChange("radiusLg", v)}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1.5 rounded-md border bg-background p-3">{children}</div>
    </div>
  );
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  // The native color picker only handles `#rrggbb`. We expose it
  // alongside a free-form text input so users can keep alpha/rgba
  // values (`rgba(0,0,0,0.06)`) — the picker just disables itself
  // if the current value isn't a hex.
  const hex = toHex(value);
  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="flex-1 text-muted-foreground">{label}</label>
      <input
        type="color"
        value={hex ?? "#000000"}
        onChange={(e) => onChange(e.target.value)}
        disabled={hex === null}
        title={hex === null ? "Edit the text input — value isn't a plain hex." : undefined}
        className="h-7 w-10 cursor-pointer rounded border bg-transparent disabled:opacity-40"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="h-7 w-36 rounded border bg-background px-2 font-mono text-[11px]"
      />
    </div>
  );
}

interface FontRowProps {
  label: string;
  value: string;
  options: FontOption[];
  onChange: (next: string) => void;
}

function FontRow({ label, value, options, onChange }: FontRowProps) {
  const matched = useMemo(() => matchFontOption(value, options), [value, options]);
  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="flex-1 text-muted-foreground">{label}</label>
      <select
        value={matched?.label ?? "__custom__"}
        onChange={(e) => {
          const opt = options.find((o) => o.label === e.target.value);
          if (opt) onChange(opt.value);
        }}
        className="h-7 rounded border bg-background px-2 text-[11px]"
      >
        {options.map((o) => (
          <option key={o.label} value={o.label}>
            {o.label}
          </option>
        ))}
        {!matched && <option value="__custom__">Custom (CSS tab)</option>}
      </select>
      <span
        className="hidden flex-1 truncate font-mono text-[10px] text-muted-foreground sm:block"
        style={{ fontFamily: value }}
        title={value}
      >
        AaBbCc 123
      </span>
    </div>
  );
}

interface RadiusRowProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
}

function RadiusRow({ label, value, onChange }: RadiusRowProps) {
  // Slider for px values; falls back to text-only for non-px (rem,
  // em, %) so the user can hand-edit unusual radii on the CSS tab.
  const px = parsePx(value);
  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="flex-1 text-muted-foreground">{label}</label>
      <input
        type="range"
        min={0}
        max={32}
        step={1}
        value={px ?? 0}
        disabled={px === null}
        onChange={(e) => onChange(`${e.target.value}px`)}
        className="h-7 w-32"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="h-7 w-20 rounded border bg-background px-2 font-mono text-[11px]"
      />
    </div>
  );
}

function CssEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        CSS tokens
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={28}
        className="w-full rounded-md border bg-background p-3 font-mono text-xs"
        spellCheck={false}
        required
      />
      <span className="text-[11px] text-muted-foreground">
        Free-form CSS. Switch to Visual to re-parse this into the form.
      </span>
    </label>
  );
}

function fontUrlsFor(values: ThemeFormValues): string[] {
  const all = [...SANS_FONTS, ...MONO_FONTS];
  const urls = new Set<string>();
  for (const value of [values.fontBase, values.fontDisplay, values.fontMono]) {
    const opt = matchFontOption(value, all);
    if (opt?.googleFontsUrl) urls.add(opt.googleFontsUrl);
  }
  return Array.from(urls);
}

// `#rrggbb` only — `<input type="color">` chokes on rgba/keywords.
// Returns null when the value can't be represented; the picker
// disables itself in that case and the user edits the text input.
function toHex(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function parsePx(value: string): number | null {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)px$/);
  if (!m) return null;
  return Math.round(Number(m[1]));
}
