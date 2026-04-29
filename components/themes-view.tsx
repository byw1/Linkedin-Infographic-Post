"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

interface Theme {
  id: string;
  name: string;
  isOfficial: boolean;
  // Member endpoint returns isMine; admin endpoint returns owner + isSystem.
  isMine?: boolean;
  isSystem?: boolean;
  owner?: { id: string; name: string | null; email: string } | null;
  fontFamily: string | null;
  tokens: Record<string, string>;
  renderCount?: number;
  updatedAt: string;
  createdAt?: string;
}

interface Props {
  mode: "member" | "admin";
}

const SWATCH_KEYS = ["--bg-canvas", "--bg-panel", "--accent", "--signal", "--fg-primary"];

const STARTER_TEMPLATE = `/* Paste your brand tokens. Keep the structure below — viral
   reads the --bg-*, --fg-*, --edge-*, --accent*, --signal*, and
   --font-* keys. Anything else is preserved but ignored. */
:root {
  --bg-canvas: #0a0a0a;
  --bg-panel: #161616;
  --bg-panel-raised: #1f1f1f;
  --bg-inset: #050505;

  --fg-primary: #fafafa;
  --fg-secondary: #d4d4d4;
  --fg-tertiary: #a3a3a3;
  --fg-muted: #737373;
  --fg-on-accent: #ffffff;

  --edge-hairline: rgba(255,255,255,0.08);
  --edge-strong: rgba(255,255,255,0.16);

  --accent: #6366f1;
  --accent-hover: #818cf8;
  --accent-soft: rgba(99,102,241,0.12);

  --signal: #f59e0b;
  --signal-success: #10b981;
  --signal-warn: #f59e0b;
  --signal-error: #ef4444;

  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-display: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
`;

export function ThemesView({ mode }: Props) {
  const listUrl = mode === "admin" ? "/api/admin/themes" : "/api/themes";
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(listUrl);
    if (!res.ok) return;
    const data = await res.json();
    setThemes(data.themes);
  }

  useEffect(() => {
    void reload();
  }, [listUrl]);

  if (themes === null) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          New theme
        </button>
      </div>

      {creating && (
        <ThemeForm
          mode={mode}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void reload();
          }}
        />
      )}

      {themes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No themes yet.</p>
      ) : (
        <div className="space-y-3">
          {themes.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              mode={mode}
              isEditing={editingId === t.id}
              onEdit={() => setEditingId(t.id)}
              onCancelEdit={() => setEditingId(null)}
              onChanged={async () => {
                setEditingId(null);
                await reload();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  theme: Theme;
  mode: "member" | "admin";
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onChanged: () => Promise<void> | void;
}

function ThemeCard({ theme, mode, isEditing, onEdit, onCancelEdit, onChanged }: CardProps) {
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // System themes (no owner) can't be deleted from any UI; admins can
  // unpublish them but the row stays so the renderer's fallback works.
  const canEdit =
    mode === "admin" ||
    theme.isMine === true ||
    (theme.isMine === undefined && !theme.isSystem);
  const canDelete = canEdit && !theme.isSystem;

  function deleteTheme() {
    if (!confirm(`Delete "${theme.name}"? This can't be undone.`)) return;
    setError(null);
    startBusy(async () => {
      const res = await fetch(`/api/themes/${theme.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Delete failed.");
        return;
      }
      await onChanged();
    });
  }

  function togglePublish() {
    setError(null);
    startBusy(async () => {
      const res = await fetch(`/api/admin/themes/${theme.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOfficial: !theme.isOfficial }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Toggle failed.");
        return;
      }
      await onChanged();
    });
  }

  if (isEditing) {
    return (
      <ThemeForm
        mode={mode}
        existing={theme}
        onCancel={onCancelEdit}
        onSaved={() => {
          void onChanged();
        }}
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{theme.name}</h3>
            {theme.isOfficial && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                Official
              </span>
            )}
            {theme.isSystem && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                System
              </span>
            )}
            {theme.isMine === true && !theme.isSystem && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                Mine
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {theme.fontFamily ?? "—"}
            {mode === "admin" && theme.owner && (
              <>
                {" "}
                · {theme.owner.email}
              </>
            )}
            {mode === "admin" && typeof theme.renderCount === "number" && (
              <>
                {" "}
                · {theme.renderCount} render{theme.renderCount === 1 ? "" : "s"}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === "admin" && (
            <button
              type="button"
              onClick={togglePublish}
              disabled={busy}
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary disabled:opacity-50"
            >
              {theme.isOfficial ? "Unpublish" : "Publish"}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={busy}
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary disabled:opacity-50"
            >
              Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={deleteTheme}
              disabled={busy}
              className="inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {SWATCH_KEYS.map((k) => {
          const v = theme.tokens?.[k];
          if (!v) return null;
          return (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="h-5 w-5 rounded border"
                style={{ background: v }}
                title={`${k}: ${v}`}
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                {k.replace("--", "")}
              </span>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface FormProps {
  mode: "member" | "admin";
  existing?: Theme;
  onCancel: () => void;
  onSaved: () => void;
}

function ThemeForm({ mode, existing, onCancel, onSaved }: FormProps) {
  const isEdit = Boolean(existing);
  const [name, setName] = useState(existing?.name ?? "");
  const [css, setCss] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  // Editing: load the existing CSS lazily so we don't ship every
  // theme's full CSS on the list view.
  useEffect(() => {
    if (!existing) {
      setCss(STARTER_TEMPLATE);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/themes/${existing.id}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setCss(data.theme.css);
    })();
    return () => {
      cancelled = true;
    };
  }, [existing]);

  const tokens = useMemo(() => parseTokensClient(css), [css]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSubmit(async () => {
      const url = isEdit
        ? `/api/themes/${existing!.id}`
        : mode === "admin"
          ? "/api/admin/themes"
          : "/api/themes";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { name, css }
        : mode === "admin"
          ? { name, css, isOfficial: true }
          : { name, css };
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
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !css.trim()}
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

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          CSS tokens
        </span>
        <textarea
          value={css}
          onChange={(e) => setCss(e.target.value)}
          rows={18}
          className="w-full rounded-md border bg-background p-3 font-mono text-xs"
          spellCheck={false}
          required
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {SWATCH_KEYS.map((k) => {
          const v = tokens[k];
          if (!v) return null;
          return (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="h-5 w-5 rounded border"
                style={{ background: v }}
                title={`${k}: ${v}`}
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                {k.replace("--", "")}
              </span>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

// Mirror of lib/themes.ts parseTokens for live preview only — kept
// inline so this client component doesn't import server-side code.
function parseTokensClient(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[a-zA-Z][\w-]*)\s*:\s*([^;}\n]+)\s*[;}\n]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out[m[1]] = m[2].trim();
  }
  return out;
}
