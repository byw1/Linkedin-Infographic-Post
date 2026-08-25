"use client";

import { useEffect, useState, useTransition } from "react";
import { ThemeForm } from "@/components/themes/theme-form";

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

// Each swatch reads the canonical token first, then falls back through
// the legacy `--bg-*` / `--fg-*` / `--accent` names so a theme pasted
// in either convention still renders chips correctly.
const SWATCH_KEYS: { label: string; keys: string[] }[] = [
  {
    label: "background-primary",
    keys: ["--color-background-primary", "--bg-canvas"],
  },
  {
    label: "background-secondary",
    keys: ["--color-background-secondary", "--bg-panel"],
  },
  { label: "accent-primary", keys: ["--color-accent-primary", "--accent"] },
  {
    label: "accent-secondary",
    keys: ["--color-accent-secondary", "--accent-hover"],
  },
  { label: "text-primary", keys: ["--color-text-primary", "--fg-primary"] },
];

function readToken(
  tokens: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const k of keys) if (tokens[k]) return tokens[k];
  return undefined;
}

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
          className="inline-flex h-9 items-center bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer outline-none focus-visible:border-ring"
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

function ThemeCard({
  theme,
  mode,
  isEditing,
  onEdit,
  onCancelEdit,
  onChanged,
}: CardProps) {
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
        setError(
          typeof body.error === "string" ? body.error : "Toggle failed.",
        );
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
    <div className="border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{theme.name}</h3>
            {theme.isOfficial && (
              <span className="bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                Official
              </span>
            )}
            {theme.isSystem && (
              <span className="bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                System
              </span>
            )}
            {theme.isMine === true && !theme.isSystem && (
              <span className="bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                Mine
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {theme.fontFamily ?? "—"}
            {mode === "admin" && theme.owner && <> · {theme.owner.email}</>}
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
              className="inline-flex h-8 items-center border px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
            >
              {theme.isOfficial ? "Unpublish" : "Publish"}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={busy}
              className="inline-flex h-8 items-center border px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
            >
              Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={deleteTheme}
              disabled={busy}
              className="inline-flex h-8 items-center border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {SWATCH_KEYS.map((sw) => {
          const v = readToken(theme.tokens ?? {}, sw.keys);
          if (!v) return null;
          return (
            <div key={sw.label} className="flex items-center gap-1.5">
              <span
                className="h-5 w-5 border"
                style={{ background: v }}
                title={`${sw.keys[0]}: ${v}`}
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                {sw.label}
              </span>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
