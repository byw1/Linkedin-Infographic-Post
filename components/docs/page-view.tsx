"use client";

import { useState } from "react";
import { DocsMarkdown } from "@/components/docs/docs-markdown";
import { PageEditor } from "@/components/docs/page-editor";

export interface DocPage {
  id: string;
  slug: string;
  title: string;
  markdown: string;
  position: number;
  updatedAt: string | null;
  updatedBy: { name: string | null; email: string } | null;
}

interface Props {
  page: DocPage;
  canEdit: boolean;
}

// One wiki page. Read mode shows rendered markdown + a small
// metadata footnote (last edited by who, when). Edit mode (admin
// only) swaps in the side-by-side PageEditor; on save it reloads
// the route so other open tabs / sidebars pick up renames.
export function PageView({ page, canEdit }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PageEditor
        initial={page}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          // The /docs/[slug] route is server-rendered; refreshing
          // the window route picks up renames + content edits +
          // sidebar reorders without a full reload.
          if (typeof window !== "undefined") {
            window.location.reload();
          }
        }}
      />
    );
  }

  return (
    <article className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">{page.title}</h2>
          {page.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Last edited {new Date(page.updatedAt).toLocaleString()}
              {page.updatedBy?.name
                ? ` by ${page.updatedBy.name}`
                : page.updatedBy?.email
                  ? ` by ${page.updatedBy.email}`
                  : ""}
              .
            </p>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-xs hover:bg-secondary"
          >
            Edit
          </button>
        )}
      </div>
      <div className="docs-prose">
        <DocsMarkdown markdown={page.markdown} />
      </div>
    </article>
  );
}
