"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { DocsMarkdown } from "@/components/docs/docs-markdown";
import type { DocPage } from "@/components/docs/page-view";

interface Props {
  initial: DocPage;
  onCancel: () => void;
  // Fired once a save / rename / delete settles. The caller is
  // responsible for unmounting / reloading.
  onSaved: () => void;
}

// Admin editor for a wiki page. Toolbar controls cover rename
// (title + slug; empty slug auto-derives from title) + section
// move (free-form, autocompletes from existing sections) + delete +
// save / cancel. Body is a side-by-side textarea + live preview so
// formatting + tool/skill cards + callouts render as the admin types.
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

      <div className="grid gap-3 lg:grid-cols-2">
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          spellCheck={false}
          rows={28}
          className="w-full rounded-md border bg-background p-3 font-mono text-xs leading-relaxed"
          placeholder="# Page heading"
        />
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
