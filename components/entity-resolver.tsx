"use client";

import { useMemo, useState, useTransition } from "react";
import type { ResolvedEntity } from "@/types/entity";
import { LibraryPicker } from "@/components/library-picker";

interface Props {
  initialEntities: ResolvedEntity[];
  onEntitiesChange: (next: ResolvedEntity[]) => void;
  onBack: () => void;
  onRender: (mapping: Record<string, string>) => Promise<void>;
  storageReady: boolean;
  backLabel?: string;
  renderLabel?: string;
  renderingLabel?: string;
}

export function EntityResolver({
  initialEntities,
  onEntitiesChange,
  onBack,
  onRender,
  storageReady,
  backLabel = "← Use a different file",
  renderLabel = "Render PNG",
  renderingLabel = "Queueing...",
}: Props) {
  const [entities, setEntities] = useState<ResolvedEntity[]>(initialEntities);
  const [error, setError] = useState<string | null>(null);
  const [rendering, startRender] = useTransition();

  const total = entities.length;
  const resolved = useMemo(() => entities.filter((e) => e.resolved), [entities]);
  const unknown = useMemo(() => entities.filter((e) => !e.resolved), [entities]);
  const allResolved = total > 0 && unknown.length === 0;

  function update(slug: string, patch: Partial<ResolvedEntity>) {
    const next = entities.map((e) => (e.slug === slug ? { ...e, ...patch } : e));
    setEntities(next);
    onEntitiesChange(next);
  }

  function startRenderClick() {
    setError(null);
    if (!allResolved) return;
    if (!storageReady) {
      setError("Storage isn't configured. PNG export is disabled.");
      return;
    }
    const mapping: Record<string, string> = {};
    for (const e of entities) {
      if (e.logo_url) mapping[e.slug] = e.logo_url;
    }
    startRender(async () => {
      try {
        await onRender(mapping);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {backLabel}
        </button>
        <span className="text-sm text-muted-foreground">
          {resolved.length} of {total} resolved
        </span>
      </div>

      {unknown.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Need logos
          </h2>
          <div className="space-y-3">
            {unknown.map((e) => (
              <UnknownCard
                key={e.slug}
                entity={e}
                onResolved={(logoUrl, displayName) =>
                  update(e.slug, { resolved: true, logo_url: logoUrl, display_name: displayName })
                }
              />
            ))}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resolved
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {resolved.map((e) => (
              <ResolvedCard
                key={e.slug}
                entity={e}
                onResolved={(logoUrl, displayName) =>
                  update(e.slug, { resolved: true, logo_url: logoUrl, display_name: displayName })
                }
                onUnresolve={() =>
                  update(e.slug, { resolved: false, logo_url: undefined, display_name: undefined })
                }
              />
            ))}
          </div>
        </section>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={startRenderClick}
          disabled={!allResolved || rendering || !storageReady}
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {rendering ? renderingLabel : renderLabel}
        </button>
      </div>
    </div>
  );
}

function UnknownCard({
  entity,
  onResolved,
}: {
  entity: ResolvedEntity;
  onResolved: (logoUrl: string, displayName: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-md border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-medium">{entity.slug}</div>
            <div className="text-xs text-muted-foreground">
              ×{entity.count} · {entity.shape_hint}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
          >
            Use from library
          </button>
        </div>
        <UploadControls
          entity={entity}
          onResolved={onResolved}
        />
      </div>
      <LibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={async (picked) => {
          setPickerOpen(false);
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
          if (res.ok) {
            const data = await res.json();
            onResolved(data.logo_url, data.entity?.displayName ?? picked.displayName);
          }
        }}
      />
    </>
  );
}

function ResolvedCard({
  entity,
  onResolved,
  onUnresolve,
}: {
  entity: ResolvedEntity;
  onResolved: (logoUrl: string, displayName: string) => void;
  onUnresolve: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-start gap-3">
        <div className="relative">
          {imgError ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-destructive/10 text-xs text-destructive">
              broken
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entity.logo_url ?? ""}
              alt={entity.slug}
              onError={() => setImgError(true)}
              className={
                entity.shape_hint === "circle"
                  ? "h-16 w-16 rounded-full object-cover"
                  : "h-16 w-16 rounded-md object-cover"
              }
            />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="truncate text-sm font-medium">
            {entity.display_name ?? entity.slug}
          </div>
          <div className="truncate text-xs text-muted-foreground">{entity.slug}</div>
          <div className="text-xs text-muted-foreground">
            ×{entity.count} · {entity.shape_hint}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {editing ? "Done" : "Replace"}
        </button>
      </div>

      {editing && (
        <div className="space-y-2 border-t pt-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
          >
            Use from library
          </button>
          <UploadControls entity={entity} onResolved={onResolved} compact />
          <button
            type="button"
            onClick={onUnresolve}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Clear (mark unresolved)
          </button>
        </div>
      )}

      <LibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={async (picked) => {
          setPickerOpen(false);
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
          if (res.ok) {
            const data = await res.json();
            onResolved(data.logo_url, data.entity?.displayName ?? picked.displayName);
            setImgError(false);
            setEditing(false);
          }
        }}
      />
    </div>
  );
}

function UploadControls({
  entity,
  onResolved,
  compact,
}: {
  entity: ResolvedEntity;
  onResolved: (logoUrl: string, displayName: string) => void;
  compact?: boolean;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
      setUrlInput("");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-xs hover:bg-secondary">
          {pending ? "Uploading..." : compact ? "Upload" : "Upload file"}
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
        <span className="text-xs text-muted-foreground">or</span>
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://example.com/logo.png"
          disabled={pending}
          className="h-8 flex-1 min-w-[12rem] rounded-md border bg-background px-2 text-xs"
        />
        <button
          type="button"
          onClick={uploadUrl}
          disabled={pending || !urlInput.trim()}
          className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary disabled:opacity-50"
        >
          Save URL
        </button>
      </div>
      {error && (
        <p className="text-xs text-destructive">
          {error}
          {error.toLowerCase().includes("unsupported") && (
            <>
              {" "}
              · Try downloading the image and uploading the file instead — sites
              like LinkedIn often block server-side fetching.
            </>
          )}
        </p>
      )}
    </div>
  );
}
