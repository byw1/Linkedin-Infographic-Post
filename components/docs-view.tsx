"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocsRecord {
  markdown: string;
  updatedAt: string | null;
  updatedById: string | null;
  updatedByName: string | null;
}

export function DocsView({
  initial,
  initialCustomized,
  canEdit,
}: {
  initial: DocsRecord;
  initialCustomized: boolean;
  canEdit: boolean;
}) {
  const [docs, setDocs] = useState<DocsRecord>(initial);
  const [customized, setCustomized] = useState(initialCustomized);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial.markdown);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit() {
    setDraft(docs.markdown);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/docs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      // Re-pull the updated record so we see the new updatedAt + author.
      const refresh = await fetch("/api/docs");
      if (refresh.ok) {
        const body = await refresh.json();
        setDocs(body.docs);
        setCustomized(body.customized);
      } else {
        setDocs((d) => ({ ...d, markdown: draft }));
        setCustomized(true);
      }
      setEditing(false);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {customized && docs.updatedAt ? (
            <>
              Last updated {new Date(docs.updatedAt).toLocaleString()}
              {docs.updatedByName ? ` by ${docs.updatedByName}` : ""}.
            </>
          ) : (
            <>
              Showing the default starter content. {canEdit ? "Edit to make it ours." : "An admin hasn't customized this yet."}
            </>
          )}
        </p>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={28}
            className="w-full rounded-md border bg-background p-3 font-mono text-xs leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            Markdown — headings, bullet lists, links, code blocks, tables (GFM).
            Saved instantly; no preview tab yet, just save and see.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <article className="docs-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {docs.markdown}
          </ReactMarkdown>
        </article>
      )}
    </div>
  );
}
