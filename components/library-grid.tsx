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

interface PageState {
  entities: Entity[];
  nextCursor: string | null;
}

const PAGE_SIZE = 60;

export function LibraryGrid() {
  const [state, setState] = useState<PageState | null>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingMore, startLoadMore] = useTransition();

  async function loadFirstPage(q: string) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (q) params.set("search", q);
    const res = await fetch(`/api/library?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setState({ entities: data.entities, nextCursor: data.next_cursor ?? null });
  }

  function loadMore() {
    if (!state?.nextCursor) return;
    startLoadMore(async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        cursor: state.nextCursor!,
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/library?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setState((prev) =>
        prev
          ? {
              entities: [...prev.entities, ...data.entities],
              nextCursor: data.next_cursor ?? null,
            }
          : { entities: data.entities, nextCursor: data.next_cursor ?? null },
      );
    });
  }

  useEffect(() => {
    void loadFirstPage(search);
  }, [search]);

  const entities = state?.entities ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug..."
          className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
        />
        {entities && (
          <span className="text-xs text-muted-foreground">
            {entities.length} shown{state?.nextCursor ? " · more available" : ""}
          </span>
        )}
      </div>

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
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {entities.map((e) => (
              <LibraryCard
                key={e.id}
                entity={e}
                editing={editingId === e.id}
                onEdit={() => setEditingId(e.id)}
                onDone={() => {
                  setEditingId(null);
                  void loadFirstPage(search);
                }}
              />
            ))}
          </div>
          {state?.nextCursor && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-secondary disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
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
  const [imgError, setImgError] = useState<string | null>(null);

  async function diagnoseImage() {
    try {
      const res = await fetch(entity.logoUrl, { credentials: "same-origin" });
      const status = `${res.status} ${res.statusText}`.trim();
      const ct = res.headers.get("content-type") ?? "";
      if (res.ok) {
        setImgError(
          `fetched ${status} (${ct}) but <img> rejected the bytes — URL: ${entity.logoUrl}`,
        );
        return;
      }
      const body = await res.text().catch(() => "");
      const isHtml = ct.includes("text/html") || body.startsWith("<!DOCTYPE");
      const detail = isHtml
        ? `framework 404 page (route /api/files/[...key] not deployed yet — redeploy) at ${entity.logoUrl}`
        : body
          ? `${status}: ${body.slice(0, 200)} — URL: ${entity.logoUrl}`
          : `${status} — URL: ${entity.logoUrl}`;
      setImgError(detail);
    } catch (err) {
      setImgError(
        `network error: ${(err as Error).message} — URL: ${entity.logoUrl}`,
      );
    }
  }

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
    setError(null);
    const form = new FormData();
    form.append("slug", entity.slug);
    form.append("type", entity.type);
    form.append("shape", entity.shapePreference);
    form.append("file", file);
    startTransition(async () => {
      const res = await fetch("/api/entities", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          typeof data?.error === "string"
            ? data.error
            : `Replace failed (${res.status}).`;
        setError(msg);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-start gap-3">
        {imgError !== null ? (
          <div
            className={
              entity.shapePreference === "circle"
                ? "flex h-16 w-16 items-center justify-center rounded-full border bg-destructive/10 text-[10px] text-destructive"
                : "flex h-16 w-16 items-center justify-center rounded-md border bg-destructive/10 text-[10px] text-destructive"
            }
            title={imgError || "Logo failed to load."}
          >
            broken
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entity.logoUrl}
            alt={entity.slug}
            onError={() => {
              setImgError("");
              void diagnoseImage();
            }}
            className={
              entity.shapePreference === "circle"
                ? "h-16 w-16 rounded-full object-cover"
                : "h-16 w-16 rounded-md object-cover"
            }
          />
        )}
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

      {imgError && (
        <p className="break-words text-xs text-destructive">
          <span className="font-medium">Image load failed:</span> {imgError}
        </p>
      )}
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
