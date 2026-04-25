"use client";

import { useEffect, useState } from "react";

interface Entity {
  id: string;
  slug: string;
  displayName: string;
  logoUrl: string;
  shapePreference: "square" | "circle" | "auto";
  usageCount: number;
}

export function LibraryPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (entity: Entity) => void;
}) {
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setEntities(null);
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/library");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setEntities(data.entities);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const filtered = (entities ?? []).filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.slug.toLowerCase().includes(q) || e.displayName.toLowerCase().includes(q);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="mt-16 w-full max-w-lg space-y-3 rounded-lg border bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Use existing logo from library</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {entities === null && (
            <p className="p-2 text-sm text-muted-foreground">Loading…</p>
          )}
          {entities && filtered.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">
              {entities.length === 0 ? "Library is empty." : "No matches."}
            </p>
          )}
          {filtered.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPick(e)}
              className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-secondary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={e.logoUrl}
                alt={e.slug}
                className={`h-10 w-10 ${e.shapePreference === "circle" ? "rounded-full" : "rounded-sm"} object-cover`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{e.displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{e.slug}</div>
              </div>
              <div className="text-xs text-muted-foreground">×{e.usageCount}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
