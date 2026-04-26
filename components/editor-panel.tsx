"use client";

import { useEffect, useState, useTransition } from "react";
import type { ResolvedEntity } from "@/types/entity";
import { LibraryPicker } from "@/components/library-picker";

interface RecentLogo {
  id: string;
  slug: string;
  displayName: string;
  logoUrl: string;
  shapePreference: "square" | "circle" | "auto";
}

interface Props {
  entity: ResolvedEntity;
  onClose: () => void;
  onResolved: (logoUrl: string, displayName: string) => void;
  onUnresolve: () => void;
}

export function EditorPanel({ entity, onClose, onResolved, onUnresolve }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recents, setRecents] = useState<RecentLogo[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/library?limit=8");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setRecents((data.entities ?? []).slice(0, 8));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function uploadFile(file: File) {
    setError(null);
    const form = new FormData();
    form.append("slug", entity.slug);
    form.append("type", "company");
    form.append("shape", entity.shape_hint);
    form.append("file", file);
    startTransition(async () => {
      const res = await fetch("/api/entities", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Upload failed.");
        return;
      }
      const data = await res.json();
      onResolved(data.logo_url, data.entity?.displayName ?? entity.slug);
    });
  }

  function uploadUrl() {
    setError(null);
    if (!urlInput.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: entity.slug,
          type: "company",
          shape: entity.shape_hint,
          url: urlInput.trim(),
          source_url: urlInput.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Upload failed.");
        return;
      }
      const data = await res.json();
      onResolved(data.logo_url, data.entity?.displayName ?? entity.slug);
    });
  }

  function pickExisting(picked: RecentLogo) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: entity.slug,
          existing_slug: picked.slug,
          display_name: picked.displayName,
          shape: entity.shape_hint,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Couldn't link logo.");
        return;
      }
      const data = await res.json();
      onResolved(data.logo_url, data.entity?.displayName ?? picked.displayName);
    });
  }

  return (
    <>
      {/* Click-outside scrim */}
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/30"
      />

      <aside
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-l bg-background p-5 shadow-2xl sm:max-w-md"
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {entity.resolved ? "Replace" : "Pick a logo for"}
            </div>
            <div className="truncate text-lg font-semibold">{entity.slug}</div>
            <div className="text-xs text-muted-foreground">
              ×{entity.count} · {entity.shape_hint}
              {entity.display_name && entity.resolved && (
                <> · currently &ldquo;{entity.display_name}&rdquo;</>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </header>

        {entity.resolved && entity.logo_url && (
          <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entity.logo_url}
              alt={entity.slug}
              className={
                entity.shape_hint === "circle"
                  ? "h-12 w-12 rounded-full object-cover"
                  : "h-12 w-12 rounded-md object-cover"
              }
            />
            <span className="text-xs text-muted-foreground">Currently using this</span>
          </div>
        )}

        {recents.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent logos
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {recents.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickExisting(r)}
                  disabled={pending}
                  title={`Use ${r.displayName}`}
                  className="group flex flex-col items-center gap-1 rounded-md border p-2 hover:bg-secondary disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.logoUrl}
                    alt={r.slug}
                    className={
                      r.shapePreference === "circle"
                        ? "h-10 w-10 rounded-full object-cover"
                        : "h-10 w-10 rounded-md object-cover"
                    }
                  />
                  <span className="w-full truncate text-[10px] text-muted-foreground group-hover:text-foreground">
                    {r.displayName}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Browse all in library →
            </button>
          </section>
        )}

        <section className="space-y-2 border-t pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Upload new
          </h3>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-sm hover:bg-secondary/40">
            {pending ? "Uploading..." : "Drop or click to upload an image"}
            <input
              type="file"
              accept="image/*"
              disabled={pending}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
            />
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/logo.png"
              disabled={pending}
              className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") uploadUrl();
              }}
            />
            <button
              type="button"
              onClick={uploadUrl}
              disabled={pending || !urlInput.trim()}
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-secondary disabled:opacity-50"
            >
              Save URL
            </button>
          </div>
        </section>

        {error && (
          <p className="break-words rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {entity.resolved && (
          <button
            type="button"
            onClick={onUnresolve}
            className="text-left text-xs text-muted-foreground hover:text-destructive"
          >
            Clear (mark unresolved)
          </button>
        )}
      </aside>

      <LibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(picked) => {
          setPickerOpen(false);
          pickExisting(picked);
        }}
      />
    </>
  );
}
