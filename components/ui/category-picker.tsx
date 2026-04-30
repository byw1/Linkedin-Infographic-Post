"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
  // Existing categories from elsewhere (other tools' categories)
  // surface as suggestions while typing.
  suggestions?: string[];
  placeholder?: string;
}

// Single-select chip picker. Same Notion-style UX as TagInput but
// caps at one value — selecting a new option replaces the existing
// one, the × on the chip clears it. Used for Tool.category where
// each tool gets exactly one bucket.
export function CategoryPicker({
  value,
  onChange,
  suggestions = [],
  placeholder = "Pick or create a category…",
}: Props) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    return suggestions
      .filter((s) => s !== value)
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [draft, suggestions, value]);

  // Categories preserve casing — they're labels (Outreach,
  // Scheduling) not tag-like slugs. Trim whitespace runs but keep
  // capitalization the user typed.
  const cleaned = draft.trim().replace(/\s+/g, " ");
  const canCreate =
    cleaned.length > 0 &&
    cleaned !== value &&
    !suggestions.some((s) => s.toLowerCase() === cleaned.toLowerCase());

  function commit(next: string) {
    const t = next.trim().replace(/\s+/g, " ");
    if (!t) return;
    onChange(t);
    setDraft("");
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setDraft("");
    inputRef.current?.focus();
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "Enter" && draft.trim()) {
      ev.preventDefault();
      commit(draft);
    } else if (ev.key === "Backspace" && !draft && value) {
      ev.preventDefault();
      clear();
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
        {value && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full border bg-primary/10 px-2 text-[11px] text-foreground">
            {value}
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                clear();
              }}
              aria-label={`Clear category ${value}`}
              className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            >
              ×
            </button>
          </span>
        )}
        {!value && (
          <input
            ref={inputRef}
            value={draft}
            onChange={(ev) => {
              setDraft(ev.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="min-w-[10rem] flex-1 bg-transparent py-0.5 text-xs outline-none placeholder:text-muted-foreground"
          />
        )}
      </div>

      {open && !value && (filtered.length > 0 || canCreate) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border bg-card p-1 text-xs text-card-foreground shadow-lg">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => commit(s)}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-secondary"
            >
              <span>{s}</span>
              <span className="text-[10px] text-muted-foreground">existing</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => commit(draft)}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-secondary"
            >
              <span>
                Create <span className="font-medium">{cleaned}</span>
              </span>
              <span className="text-[10px] text-muted-foreground">new</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
