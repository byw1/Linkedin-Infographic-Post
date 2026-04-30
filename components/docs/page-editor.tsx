"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Download, Wrench } from "lucide-react";
import { DocsMarkdown } from "@/components/docs/docs-markdown";
import type { DocPage } from "@/components/docs/page-view";

interface Props {
  initial: DocPage;
  onCancel: () => void;
  // Fired once a save / rename / delete settles. The caller is
  // responsible for unmounting / reloading.
  onSaved: () => void;
}

interface ToolItem {
  id: string;
  name: string;
  url: string;
}

interface SkillItem {
  id: string;
  name: string;
  filename: string;
}

interface SlashMatch {
  kind: "tool" | "skill";
  id: string;
  name: string;
  hint: string;
}

// Cap the suggestion list so the picker stays compact.
const SLASH_LIMIT = 6;

// Admin editor for a wiki page. Toolbar controls cover rename
// (title + slug; empty slug auto-derives from title) + section
// move (free-form, autocompletes from existing sections) + delete +
// save / cancel. Body is a side-by-side textarea + live preview so
// formatting + tool/skill cards + callouts render as the admin types.
//
// Typing `/tool` or `/skill` in the body opens an inline picker that
// inserts a `[Name](tool:<uuid>)` markdown link on selection — the
// DocsMarkdown renderer then turns those links into compact cards in
// the published page.
export function PageEditor({ initial, onCancel, onSaved }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [section, setSection] = useState(initial.section ?? "");
  const [knownSections, setKnownSections] = useState<string[]>([]);
  const [markdown, setMarkdown] = useState(initial.markdown);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  // Pull every existing section name once so the section input can
  // autocomplete via <datalist>. Keeps admins from inventing
  // "Part 1: …" alongside an existing "Part I: …".
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/docs/pages");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      const set = new Set<string>();
      for (const p of data.pages as Array<{ section: string | null }>) {
        if (p.section) set.add(p.section);
      }
      if (!cancelled) setKnownSections(Array.from(set).sort());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Track whether the user has manually edited the slug. If they
  // haven't, we keep auto-deriving it from the title so renaming
  // a page renames its URL too without an extra step. Once they
  // type in the slug field, we leave it alone.
  const [slugTouched, setSlugTouched] = useState(false);
  const previewMarkdown = useMemo(() => markdown, [markdown]);

  // ---------- slash-command picker -----------------------------------

  const [tools, setTools] = useState<ToolItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [pickerIndex, setPickerIndex] = useState(0);
  // Once the user dismisses the picker via Escape, we suppress it
  // until the trigger position changes (i.e. they start a new one).
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Fetch the tool + skill catalog once. Same shape as DocsMarkdown's
  // loader — open to any signed-in user.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [toolsRes, skillsRes] = await Promise.all([
        fetch("/api/tools").catch(() => null),
        fetch("/api/skills").catch(() => null),
      ]);
      if (cancelled) return;
      if (toolsRes?.ok) {
        const data = await toolsRes.json();
        setTools(
          (data.tools as ToolItem[]).map((t) => ({
            id: t.id,
            name: t.name,
            url: t.url,
          })),
        );
      }
      if (skillsRes?.ok) {
        const data = await skillsRes.json();
        setSkills(
          (data.skills as SkillItem[]).map((s) => ({
            id: s.id,
            name: s.name,
            filename: s.filename,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const trigger = useMemo(
    () => detectTrigger(markdown, cursor),
    [markdown, cursor],
  );

  const matches = useMemo<SlashMatch[]>(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    if (trigger.kind === "tool") {
      const pool = tools.map<SlashMatch>((t) => ({
        kind: "tool",
        id: t.id,
        name: t.name,
        hint: prettyHost(t.url),
      }));
      return (q ? pool.filter((p) => p.name.toLowerCase().includes(q)) : pool)
        .slice(0, SLASH_LIMIT);
    }
    const pool = skills.map<SlashMatch>((s) => ({
      kind: "skill",
      id: s.id,
      name: s.name,
      hint: s.filename,
    }));
    return (q ? pool.filter((p) => p.name.toLowerCase().includes(q)) : pool)
      .slice(0, SLASH_LIMIT);
  }, [trigger, tools, skills]);

  // Reset highlight + un-dismiss whenever a fresh trigger appears.
  useEffect(() => {
    setPickerIndex(0);
  }, [trigger?.kind, trigger?.query, matches.length]);
  useEffect(() => {
    if (!trigger) setDismissedStart(null);
    else if (dismissedStart !== null && dismissedStart !== trigger.start) {
      setDismissedStart(null);
    }
  }, [trigger, dismissedStart]);

  const showPicker =
    trigger !== null &&
    matches.length > 0 &&
    dismissedStart !== trigger.start;

  function applyMatch(item: SlashMatch) {
    if (!trigger) return;
    const before = markdown.slice(0, trigger.start);
    const after = markdown.slice(cursor);
    const link = `[${item.name}](${item.kind}:${item.id})`;
    const next = before + link + after;
    const newCursor = before.length + link.length;
    setMarkdown(next);
    // Restore focus + caret after the value commit lands.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(newCursor, newCursor);
      setCursor(newCursor);
    });
  }

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showPicker) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPickerIndex((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPickerIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      applyMatch(matches[pickerIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (trigger) setDismissedStart(trigger.start);
    }
  }

  function syncCursor(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    setCursor(e.currentTarget.selectionStart);
  }

  // ---------- form helpers -------------------------------------------

  function setTitleAndMaybeSlug(next: string) {
    setTitle(next);
    if (!slugTouched) {
      setSlug(
        next
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      );
    }
  }

  function save() {
    setError(null);
    if (!title.trim()) {
      setError("Title can't be empty.");
      return;
    }
    if (!slug.trim()) {
      setError("Slug can't be empty.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/docs/pages/${initial.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          section: section.trim() || null,
          markdown,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      const { page } = await res.json();
      // If the slug changed, navigate to the new URL before
      // calling onSaved so the page-view doesn't 404.
      if (page.slug !== initial.slug) {
        router.replace(`/docs/${page.slug}`);
      } else {
        onSaved();
      }
    });
  }

  function deletePage() {
    if (!confirm(`Delete "${initial.title}"? This can't be undone.`)) return;
    setError(null);
    startDelete(async () => {
      const res = await fetch(`/api/docs/pages/${initial.slug}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Delete failed.");
        return;
      }
      // Send the user back to the docs index — it'll redirect to
      // whatever page is now first.
      router.replace("/docs");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitleAndMaybeSlug(e.target.value)}
            placeholder="Page title"
            maxLength={120}
            className="h-9 w-full max-w-md rounded-md border bg-background px-3 text-base font-semibold"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={deletePage}
            disabled={pending || deleting}
            className="inline-flex h-9 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending || deleting}
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || deleting}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">/docs/</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="slug"
            maxLength={120}
            className="h-7 flex-1 rounded-md border bg-background px-2 font-mono text-xs"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Section</span>
          <input
            value={section}
            onChange={(e) => setSection(e.target.value)}
            list="page-section-list"
            placeholder="(none — appears under Other)"
            maxLength={120}
            className="h-7 flex-1 rounded-md border bg-background px-2 text-xs"
          />
          <datalist id="page-section-list">
            {knownSections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Tip: type{" "}
        <code className="rounded bg-secondary px-1 font-mono text-[10px]">
          /tool
        </code>{" "}
        or{" "}
        <code className="rounded bg-secondary px-1 font-mono text-[10px]">
          /skill
        </code>{" "}
        to insert a linked card. Use{" "}
        <code className="rounded bg-secondary px-1 font-mono text-[10px]">
          &gt; [!note]
        </code>
        ,{" "}
        <code className="rounded bg-secondary px-1 font-mono text-[10px]">
          [!tip]
        </code>
        ,{" "}
        <code className="rounded bg-secondary px-1 font-mono text-[10px]">
          [!warning]
        </code>
        , or{" "}
        <code className="rounded bg-secondary px-1 font-mono text-[10px]">
          [!important]
        </code>{" "}
        for callouts.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(e) => {
              setMarkdown(e.target.value);
              setCursor(e.target.selectionStart);
            }}
            onKeyDown={onTextareaKeyDown}
            onSelect={syncCursor}
            onClick={syncCursor}
            onKeyUp={syncCursor}
            spellCheck={false}
            rows={28}
            className="w-full rounded-md border bg-background p-3 font-mono text-xs leading-relaxed"
            placeholder="# Page heading"
          />
          {showPicker && trigger && (
            <SlashPicker
              kind={trigger.kind}
              query={trigger.query}
              matches={matches}
              activeIndex={pickerIndex}
              onHover={setPickerIndex}
              onPick={applyMatch}
            />
          )}
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            Live preview
          </div>
          <div className="docs-prose">
            <DocsMarkdown markdown={previewMarkdown} />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ---------- slash-command picker UI ----------------------------------

function SlashPicker({
  kind,
  query,
  matches,
  activeIndex,
  onHover,
  onPick,
}: {
  kind: "tool" | "skill";
  query: string;
  matches: SlashMatch[];
  activeIndex: number;
  onHover: (i: number) => void;
  onPick: (m: SlashMatch) => void;
}) {
  return (
    <div className="absolute left-2 right-2 top-full z-20 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>
          {kind === "tool" ? "Tools" : "Skills"}
          {query && (
            <>
              {" · "}
              <span className="lowercase text-foreground/80">{query}</span>
            </>
          )}
        </span>
        <span>↑↓ enter</span>
      </div>
      <ul className="max-h-64 overflow-y-auto py-1">
        {matches.map((m, i) => (
          <li key={`${m.kind}:${m.id}`}>
            <button
              type="button"
              onMouseDown={(e) => {
                // Keep textarea focus + prevent caret jump.
                e.preventDefault();
                onPick(m);
              }}
              onMouseEnter={() => onHover(i)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs ${
                i === activeIndex
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              {m.kind === "tool" ? (
                <Wrench size={12} aria-hidden className="shrink-0" />
              ) : (
                <Download size={12} aria-hidden className="shrink-0" />
              )}
              <span className="truncate font-medium text-foreground">
                {m.name}
              </span>
              {m.hint && (
                <span className="ml-auto truncate text-[10px] text-muted-foreground/80">
                  {m.hint}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- helpers --------------------------------------------------

// Walk back from the cursor to find a `/tool` or `/skill` trigger
// preceded by whitespace (or start of file). The query is whatever
// the user has typed after the keyword, capped at the next
// whitespace — so a single space ends the trigger naturally.
function detectTrigger(
  text: string,
  cursorPos: number,
): { kind: "tool" | "skill"; start: number; query: string } | null {
  const prefix = text.slice(0, cursorPos);
  const m = prefix.match(/(?:^|\s)(\/(tool|skill)([^\s]*))$/);
  if (!m || m.index === undefined) return null;
  const fullToken = m[1];
  const kind = m[2] as "tool" | "skill";
  const query = m[3] ?? "";
  const start = prefix.length - fullToken.length;
  return { kind, start, query };
}

function prettyHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}
