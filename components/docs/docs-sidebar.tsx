"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface PageMeta {
  id: string;
  slug: string;
  title: string;
  position: number;
}

interface Props {
  pages: PageMeta[];
  canEdit: boolean;
}

// Sidebar with the wiki pages list + a fixed Skills entry at the
// bottom. Active page is highlighted via pathname match. Admins
// see a "+ New page" button at the top of the list that opens an
// inline title prompt; the rest of the page editing happens on
// the page view itself.
export function DocsSidebar({ pages, canEdit }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function activeMatch(slug: string) {
    return pathname === `/docs/${slug}`;
  }

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/docs/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Couldn't create page.");
        return;
      }
      const { page } = await res.json();
      setNewTitle("");
      setCreating(false);
      // Reload the layout so the sidebar picks up the new page,
      // then nav to the new page.
      router.push(`/docs/${page.slug}`);
      router.refresh();
    });
  }

  return (
    <nav className="space-y-4 text-sm">
      <div className="space-y-1">
        <div className="flex items-center justify-between px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Pages</span>
          {canEdit && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              + New
            </button>
          )}
        </div>

        {creating && (
          <form onSubmit={submitNew} className="space-y-1.5 px-1 py-1">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Page title"
              maxLength={120}
              className="h-8 w-full rounded-md border bg-background px-2 text-xs"
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={pending || !newTitle.trim()}
                className="inline-flex h-7 items-center rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewTitle("");
                  setError(null);
                }}
                className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-[11px] text-destructive">{error}</p>}
          </form>
        )}

        {pages.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            {canEdit ? "No pages yet — create one above." : "No pages yet."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {pages.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/docs/${p.slug}`}
                  className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                    activeMatch(p.slug)
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1 border-t pt-4">
        <div className="px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Resources
        </div>
        <ul className="space-y-0.5">
          <li>
            <Link
              href="/docs/skills"
              className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                pathname === "/docs/skills"
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              Skills
            </Link>
          </li>
          <li>
            <Link
              href="/docs/tools"
              className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                pathname === "/docs/tools"
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              Tools
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
