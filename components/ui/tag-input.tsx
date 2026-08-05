"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  // Existing tags from elsewhere in the app (e.g. other tools'
  // tags) that show up as suggestions while typing.
  suggestions?: string[];
  placeholder?: string;
}

// Notion-style multi-tag chip input. Existing tags render as
// removable chips; the trailing text input commits new tags on
// Enter / comma / Tab. A suggestions popover appears below as the
// user types — pick from existing tags or "Create" a fresh one.
// Backspace on an empty input removes the last chip.
//
// All tags are normalized to lowercase + hyphenated to keep the
// app's tag chip patterns consistent.
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add a tag…",
}: Props) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close the suggestion popover on outside click — same pattern
  // the GearPopover uses elsewhere.
  useEffect(() => {
    if (!open) return;
    function onDown(ev: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const used = new Set(value);
    return suggestions
      .filter((s) => !used.has(s))
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [draft, suggestions, value]);

  const normalized = normalize(draft);
  const canCreate =
    normalized.length > 0 &&
    !value.includes(normalized) &&
    !filtered.includes(normalized);

  function commit(tag: string) {
    const t = normalize(tag);
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
    // Keep focus on input so the user can keep adding without
    // re-clicking.
    inputRef.current?.focus();
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "Enter" || ev.key === "," || ev.key === "Tab") {
      if (draft.trim()) {
        ev.preventDefault();
        commit(draft);
      }
    } else if (ev.key === "Backspace" && !draft && value.length > 0) {
      ev.preventDefault();
      onChange(value.slice(0, -1));
    } else if (ev.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs focus-within:ring-1 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-6 items-center gap-1 rounded-full border bg-secondary px-2 font-mono text-[11px] text-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                remove(tag);
              }}
              aria-label={`Remove ${tag}`}
              className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(ev) => {
            setDraft(ev.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && (filtered.length > 0 || canCreate) && (
        // bg-card not bg-popover (the latter isn't a token in this
        // theme — was rendering transparent). text-card-foreground
        // pairs so contrast holds in dark mode.
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border bg-card p-1 text-xs text-card-foreground shadow-lg">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => commit(s)}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
            >
              <span className="font-mono">{s}</span>
              <span className="text-[10px] text-muted-foreground">existing</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => commit(draft)}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
            >
              <span>
                Create <span className="font-mono">{normalized}</span>
              </span>
              <span className="text-[10px] text-muted-foreground">new</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Lowercase + hyphenate any tag input. Mirrors the rule the API
// applies on persist (see /api/admin/tools/route.ts:dedupeTags) so
// the chip the user sees matches what the server will store.
function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
