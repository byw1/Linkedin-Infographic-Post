"use client";

import { useEffect, useState, useTransition } from "react";

interface Entity {
  id: string;
  slug: string;
  aliases: string[];
  displayName: string;
  type: string;
  shapePreference: "square" | "circle" | "auto";
  logoUrl: string;
  usageCount: number;
  lastUsedAt: string;
  uploadedBy: { id: string; name: string | null; email: string } | null;
  isMine: boolean;
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
          className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm shadow-sm transition-[color,box-shadow] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
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
  const [slug, setSlug] = useState(entity.slug);
  // Aliases live in the form as a comma-separated string for editing —
  // we normalize back to an array on save.
  const [aliasesText, setAliasesText] = useState(entity.aliases.join(", "));
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
    const trimmedSlug = slug.trim();
    const aliasesArray = aliasesText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    startTransition(async () => {
      const body: Record<string, unknown> = {
        display_name: name.trim() || entity.slug,
      };
      if (trimmedSlug && trimmedSlug !== entity.slug) body.slug = trimmedSlug;
      // Always send the aliases (even when empty) so clearing them
      // works with a single round-trip.
      body.aliases = aliasesArray;

      const res = await fetch(`/api/entities/${encodeURIComponent(entity.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      onDone();
    });
  }

  // Hide a community-uploaded entity from the current user's view.
  // Doesn't delete the underlying entity (we don't own it); just
  // adds a per-user override that suppresses it from /library +
  // pickers. Parse-time resolution still finds it.
  function hide() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/library/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: entity.slug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Hide failed.");
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
    <div className="space-y-2 rounded-xl border bg-card p-3 shadow transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
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
        <div className="min-w-0 flex-1 space-y-1">
          {editing ? (
            <>
              <label className="block">
                <span className="block text-sm font-medium text-muted-foreground">
                  Display name
                </span>
                <input
                  autoFocus
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") save();
                    if (ev.key === "Escape") onDone();
                  }}
                  className="h-7 w-full rounded-md border bg-background px-2 text-sm shadow-sm transition-[color,box-shadow] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-muted-foreground">
                  Slug
                </span>
                <input
                  value={slug}
                  onChange={(ev) => setSlug(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") save();
                    if (ev.key === "Escape") onDone();
                  }}
                  className="h-7 w-full rounded-md border bg-background px-2 font-mono text-xs shadow-sm transition-[color,box-shadow] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder="canonical-slug"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-muted-foreground">
                  Aliases
                  <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
                    (comma-separated, also resolve to this logo)
                  </span>
                </span>
                <input
                  value={aliasesText}
                  onChange={(ev) => setAliasesText(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") save();
                    if (ev.key === "Escape") onDone();
                  }}
                  className="h-7 w-full rounded-md border bg-background px-2 font-mono text-xs shadow-sm transition-[color,box-shadow] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder="sama, samaltman"
                />
              </label>
            </>
          ) : (
            <>
              <div className="truncate text-sm font-medium">{entity.displayName}</div>
              <div className="truncate text-xs text-muted-foreground">{entity.slug}</div>
              {entity.aliases.length > 0 && (
                <div className="truncate text-xs text-muted-foreground">
                  also: {entity.aliases.join(", ")}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>used {entity.usageCount}×</span>
                {entity.uploadedBy && !entity.isMine && (
                  <>
                    <span>·</span>
                    <span className="truncate" title={entity.uploadedBy.email}>
                      uploaded by{" "}
                      {entity.uploadedBy.name ?? entity.uploadedBy.email}
                    </span>
                  </>
                )}
                {entity.isMine && (
                  <>
                    <span>·</span>
                    <span className="text-[10px] text-primary">
                      mine
                    </span>
                  </>
                )}
              </div>
            </>
          )}
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
              className="inline-flex h-7 items-center rounded-md border px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
            >
              Cancel
            </button>
            <label className="inline-flex h-7 cursor-pointer items-center rounded-md border px-3 text-xs hover:bg-accent hover:text-accent-foreground transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm">
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
              className="ml-auto inline-flex h-7 items-center rounded-md border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50 cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
            >
              Delete
            </button>
          </>
        ) : entity.isMine ? (
          // Owner controls: full edit. Edit also exposes Replace
          // logo + Delete via the editing branch above.
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-7 items-center rounded-md border px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
          >
            Edit
          </button>
        ) : (
          // Community-uploaded entity. Other members can use it on
          // their renders (parse-time resolver finds it) but can't
          // rename or delete it. Hide removes it from this user's
          // own /library + pickers without affecting anyone else.
          <button
            type="button"
            onClick={hide}
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md border px-3 text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
            title="Remove from your library view (others still see it)"
          >
            {pending ? "Hiding…" : "Hide from my view"}
          </button>
        )}
      </div>
    </div>
  );
}
