"use client";

import { useEffect, useState, useTransition } from "react";

interface Tool {
  id: string;
  name: string;
  url: string;
  description: string | null;
  tags: string[];
  logoUrl: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// Admin CRUD for the Tools catalog. Keeps everything inline — a
// "+ Add tool" header button reveals a creation form; existing
// rows have inline Edit / Delete affordances. No modals; no extra
// pages. Mirrors the InvitesView pattern from /admin/invites.
export function ToolsManager() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/tools");
    if (!res.ok) return;
    const data = await res.json();
    setTools(data.tools);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Catalog{" "}
          {tools && (
            <span className="ml-1 text-[10px] font-normal lowercase">
              ({tools.length})
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
        >
          {adding ? "Cancel" : "+ Add tool"}
        </button>
      </div>

      {adding && (
        <ToolForm
          mode="create"
          onSaved={() => {
            setAdding(false);
            void load();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {tools === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {tools && tools.length === 0 && !adding && (
        <p className="rounded-md border border-dashed bg-card p-4 text-xs text-muted-foreground">
          No tools yet. Hit + Add tool above to seed the catalog with the
          first one (e.g. HeyReach, LinkedIn Helper, Taplio).
        </p>
      )}
      {tools?.map((t) => (
        <ToolRow key={t.id} tool={t} onChange={() => void load()} />
      ))}
    </div>
  );
}

function ToolRow({ tool, onChange }: { tool: Tool; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Delete ${tool.name}? Members lose it from /docs/tools.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/tools/${tool.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Delete failed.");
        return;
      }
      onChange();
    });
  }

  if (editing) {
    return (
      <ToolForm
        mode="edit"
        initial={tool}
        onSaved={() => {
          setEditing(false);
          onChange();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-card p-4 text-card-foreground">
      <div className="flex items-start gap-3">
        {tool.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={tool.logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md border bg-secondary object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-secondary text-sm font-semibold uppercase">
            {tool.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold">{tool.name}</span>
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-xs text-muted-foreground hover:text-foreground"
            >
              {tool.url}
            </a>
          </div>
          {tool.description && (
            <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
          )}
          {tool.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tool.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex h-5 items-center rounded-full border bg-secondary/50 px-2 font-mono text-[10px]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] hover:bg-secondary"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md border border-destructive/40 px-2.5 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ToolForm({
  mode,
  initial,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: Tool;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tagsText, setTagsText] = useState(initial?.tags.join(", ") ?? "");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? "");
  const [position, setPosition] = useState<string>(
    initial ? String(initial.position) : "",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const tags = tagsText
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const positionNum = position.trim() ? Number(position) : undefined;
    const body: Record<string, unknown> = {
      name: name.trim(),
      url: url.trim(),
      description: description.trim() || null,
      logoUrl: logoUrl.trim() || null,
      tags,
    };
    if (positionNum !== undefined && Number.isFinite(positionNum)) {
      body.position = positionNum;
    }

    startTransition(async () => {
      const path =
        mode === "create" ? "/api/admin/tools" : `/api/admin/tools/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(path, {
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
    <div className="space-y-3 rounded-md border-2 border-dashed bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {mode === "create" ? "New tool" : `Editing ${initial?.name}`}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder="HeyReach"
        />
        <Field
          label="URL"
          value={url}
          onChange={setUrl}
          placeholder="https://heyreach.io"
        />
      </div>
      <label className="block text-sm">
        <span className="block text-[11px] text-muted-foreground">
          Description
        </span>
        <textarea
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="What it does, in a sentence or two."
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field
          label="Logo URL (optional)"
          value={logoUrl}
          onChange={setLogoUrl}
          placeholder="https://..."
        />
        <Field
          label="Sort position"
          value={position}
          onChange={setPosition}
          placeholder="0"
        />
      </div>
      <label className="block text-sm">
        <span className="block text-[11px] text-muted-foreground">
          Tags{" "}
          <span className="text-muted-foreground/70">
            comma-separated, lowercase, hyphenated
          </span>
        </span>
        <input
          value={tagsText}
          onChange={(ev) => setTagsText(ev.target.value)}
          placeholder="automation, outreach, scheduling"
          className="h-9 w-full rounded-md border bg-background px-2 font-mono text-xs"
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-md border px-4 text-xs hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
      />
    </label>
  );
}
