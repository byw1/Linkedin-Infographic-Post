"use client";

import Link from "next/link";
import { useState } from "react";
import { DocsMarkdown } from "@/components/docs/docs-markdown";
import { PageEditor } from "@/components/docs/page-editor";

export interface DocPage {
  id: string;
  slug: string;
  title: string;
  section: string | null;
  markdown: string;
  position: number;
  updatedAt: string | null;
  updatedBy: { name: string | null; email: string } | null;
}

interface PrevNext {
  slug: string;
  title: string;
}

interface Props {
  page: DocPage;
  canEdit: boolean;
  prev?: PrevNext | null;
  next?: PrevNext | null;
}

// One wiki page. Read mode shows the section breadcrumb, rendered
// markdown, prev/next navigation tiles, and a metadata footnote.
// Edit mode (admin only) swaps in the side-by-side PageEditor; on
// save it reloads the route so other open tabs / sidebars pick up
// renames + section moves.
export function PageView({ page, canEdit, prev, next }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PageEditor
        initial={page}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          if (typeof window !== "undefined") {
            window.location.reload();
          }
        }}
      />
    );
  }

  return (
    <article className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {page.section && (
            <p className="text-[11px] font-medium text-muted-foreground">
              {page.section}
            </p>
          )}
          <h2 className="text-2xl font-semibold tracking-tight">{page.title}</h2>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
          >
            Edit
          </button>
        )}
      </div>
      <div className="docs-prose">
        <DocsMarkdown markdown={page.markdown} />
      </div>

      {(prev || next) && (
        <nav
          aria-label="Page navigation"
          className="grid gap-3 border-t pt-5 sm:grid-cols-2"
        >
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="group flex flex-col gap-0.5 rounded-md border bg-card p-3 text-card-foreground hover:bg-accent/50"
            >
              <span className="text-sm font-medium text-muted-foreground">
                ← Previous
              </span>
              <span className="text-sm font-medium group-hover:text-foreground">
                {prev.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slug}`}
              className="group flex flex-col items-end gap-0.5 rounded-md border bg-card p-3 text-card-foreground hover:bg-accent/50 sm:text-right"
            >
              <span className="text-sm font-medium text-muted-foreground">
                Next →
              </span>
              <span className="text-sm font-medium group-hover:text-foreground">
                {next.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
        </nav>
      )}

      {page.updatedAt && (
        <p className="text-[11px] text-muted-foreground">
          Last edited {new Date(page.updatedAt).toLocaleString()}
          {page.updatedBy?.name
            ? ` by ${page.updatedBy.name}`
            : page.updatedBy?.email
              ? ` by ${page.updatedBy.email}`
              : ""}
          .
        </p>
      )}
    </article>
  );
}
