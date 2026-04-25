"use client";

import { useEffect, useState, useTransition } from "react";

interface Entity {
  id: string;
  slug: string;
  displayName: string;
  type: string;
  shapePreference: "square" | "circle" | "auto";
  logoUrl: string;
  usageCount: number;
  lastUsedAt: string;
}

export function LibraryGrid() {
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load(q: string) {
    const params = new URLSearchParams();
    if (q) params.set("search", q);
    const res = await fetch(`/api/library?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setEntities(data.entities);
  }

  useEffect(() => {
    void load(search);
  }, [search]);

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or slug..."
        className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
      />

      {entities === null && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}
      {entities && entities.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No logos yet. Parse some HTML on the home page and upload logos for
          the unknowns — they&apos;ll show up here.
        </p>
      )}
      {entities && entities.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {entities.map((e) => (
            <LibraryCard
              key={e.id}
              entity={e}
              editing={editingId === e.id}
              onEdit={() => setEditingId(e.id)}
              onDone={() => {
                setEditingId(null);
                void load(search);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryCard({
  entity,
  editing,
  onEdit,
  onDone,
}: {
  entity: Entity;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(entity.displayName);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/entities/${encodeURIComponent(entity.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name.trim() || entity.slug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      onDone();
    });
  }

  function remove() {
    if (!confirm(`Delete "${entity.displayName}"? Future renders won't auto-resolve this slug.`))
      return;
    startTransition(async () => {
      const res = await fetch(`/api/entities/${encodeURIComponent(entity.slug)}`, {
        method: "DELETE",
      });
      if (res.ok) onDone();
    });
  }

  function replaceLogo(file: File) {
    const form = new FormData();
    form.append("slug", entity.slug);
    form.append("type", entity.type);
    form.append("shape", entity.shapePreference);
    form.append("file", file);
    startTransition(async () => {
      const res = await fetch("/api/entities", { method: "POST", body: form });
      if (res.ok) onDone();
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entity.logoUrl}
          alt={entity.slug}
          className={
            entity.shapePreference === "circle"
              ? "h-16 w-16 rounded-full object-cover"
              : "h-16 w-16 rounded-md object-cover"
          }
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") save();
                if (ev.key === "Escape") onDone();
              }}
              className="h-7 w-full rounded-md border bg-background px-2 text-sm"
            />
          ) : (
            <div className="truncate text-sm font-medium">{entity.displayName}</div>
          )}
          <div className="truncate text-xs text-muted-foreground">{entity.slug}</div>
          <div className="text-xs text-muted-foreground">used {entity.usageCount}×</div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="inline-flex h-7 items-center rounded-md border px-3 text-xs hover:bg-secondary"
            >
              Cancel
            </button>
            <label className="inline-flex h-7 cursor-pointer items-center rounded-md border px-3 text-xs hover:bg-secondary">
              Replace logo
              <input
                type="file"
                accept="image/*"
                disabled={pending}
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) replaceLogo(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="ml-auto inline-flex h-7 items-center rounded-md border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              Delete
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-7 items-center rounded-md border px-3 text-xs hover:bg-secondary"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
