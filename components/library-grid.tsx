"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/library?${params}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setEntities(data.entities);
    })();
    return () => {
      cancelled = true;
    };
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {entities.map((e) => (
            <div key={e.id} className="space-y-2 rounded-md border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={e.logoUrl}
                alt={e.slug}
                className={
                  e.shapePreference === "circle"
                    ? "h-16 w-16 rounded-full object-cover"
                    : "h-16 w-16 rounded-md object-cover"
                }
              />
              <div className="min-w-0 space-y-0.5">
                <div className="truncate text-sm font-medium">{e.displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{e.slug}</div>
                <div className="text-xs text-muted-foreground">
                  used {e.usageCount}×
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
