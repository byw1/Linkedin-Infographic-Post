"use client";

import { useEffect, useState, useTransition } from "react";

interface Member {
  id: string;
  slug: string;
  aliases: string[];
  displayName: string;
  shapePreference: "square" | "circle" | "auto";
  logoUrl: string;
  usageCount: number;
  sourceUrl: string | null;
}

interface Group {
  id: string;
  reason: "same-display-name" | "same-source-url";
  members: Member[];
}

const REASON_LABEL: Record<Group["reason"], string> = {
  "same-display-name": "Same display name",
  "same-source-url": "Same source URL",
};

export function DuplicateSuggestions({ onChange }: { onChange?: () => void }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function load() {
    const res = await fetch("/api/library/duplicates");
    if (!res.ok) {
      setGroups([]);
      return;
    }
    const data = await res.json();
    setGroups(data.groups);
  }

  useEffect(() => {
    void load();
  }, []);

  function dismiss(groupId: string) {
    setDismissed((d) => {
      const next = new Set(d);
      next.add(groupId);
      return next;
    });
  }

  if (groups === null) return null;

  const visible = groups.filter((g) => !dismissed.has(g.id));
  if (visible.length === 0) return null;

  return (
    <section className="rounded-xl border border-warning/30 bg-warning-bg/60 shadow">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-amber-500/10"
      >
        <span>
          <span className="font-medium text-warning">
            {visible.length} possible duplicate{visible.length === 1 ? "" : "s"}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            click to review &amp; merge
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{open ? "–" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-amber-500/20 p-4">
          {visible.map((g) => (
            <SuggestionCard
              key={g.id}
              group={g}
              onMerged={() => {
                dismiss(g.id);
                void load();
                onChange?.();
              }}
              onSkip={() => dismiss(g.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SuggestionCard({
  group,
  onMerged,
  onSkip,
}: {
  group: Group;
  onMerged: () => void;
  onSkip: () => void;
}) {
  // Default canonical = the most-used member; ties broken by id so the
  // choice is stable across renders.
  const sorted = [...group.members].sort(
    (a, b) => b.usageCount - a.usageCount || a.id.localeCompare(b.id),
  );
  const [canonicalId, setCanonicalId] = useState<string>(sorted[0].id);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function merge() {
    setError(null);
    const mergeIds = group.members.filter((m) => m.id !== canonicalId).map((m) => m.id);
    if (mergeIds.length === 0) return;
    startTransition(async () => {
      const res = await fetch("/api/library/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical_id: canonicalId, merge_ids: mergeIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Merge failed.");
        return;
      }
      onMerged();
    });
  }

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {REASON_LABEL[group.reason]}
        </span>
        <span className="text-xs text-muted-foreground">
          {group.members.length} entries
        </span>
      </div>

      <div className="space-y-2">
        {sorted.map((m) => (
          <label
            key={m.id}
            className={`flex cursor-pointer items-center gap-3 rounded-md border p-2 ${
              m.id === canonicalId ? "border-primary/60 bg-primary/5" : "hover:bg-secondary/40"
            }`}
          >
            <input
              type="radio"
              name={`canonical-${group.id}`}
              checked={m.id === canonicalId}
              onChange={() => setCanonicalId(m.id)}
              className="h-4 w-4"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.logoUrl}
              alt={m.slug}
              className={
                m.shapePreference === "circle"
                  ? "h-10 w-10 rounded-full object-cover"
                  : "h-10 w-10 rounded-md object-cover"
              }
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.displayName}</div>
              <div className="truncate font-mono text-xs text-muted-foreground">
                {m.slug}
                {m.aliases.length > 0 && ` · ${m.aliases.length} alias${m.aliases.length === 1 ? "" : "es"}`}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">used {m.usageCount}×</span>
          </label>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Merge keeps the chosen logo + display name. The other slugs become
        aliases on it, so any post that referenced the old slug still resolves.
        Usage counts add up.
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={merge}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {pending ? "Merging…" : `Merge into ${labelFor(group.members, canonicalId)}`}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex h-9 items-center rounded-md border px-4 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function labelFor(members: Member[], id: string): string {
  return members.find((m) => m.id === id)?.slug ?? "selected";
}
