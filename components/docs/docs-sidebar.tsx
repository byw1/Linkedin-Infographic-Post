"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

interface PageMeta {
  id: string;
  slug: string;
  title: string;
  section: string | null;
  position: number;
}

interface Props {
  pages: PageMeta[];
  canEdit: boolean;
}

const COLLAPSED_KEY = "viral.docs.collapsedSections.v1";
const UNCATEGORIZED = "Uncategorized";

// Sidebar with the wiki pages list — grouped by section header
// (collapsible, sticky open-state per browser), a search box at
// the top, and the fixed Skills + Tools entries below. Active
// page highlighted via pathname match. Admins see "+ New page"
// at the top of the list.
export function DocsSidebar({ pages, canEdit }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSection, setNewSection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Persist which sections are collapsed across navigations and
  // page reloads — without it every <Link> click would reset the
  // sidebar shape.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore
    }
  }, []);
  function toggleSection(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function activeMatch(slug: string) {
    return pathname === `/docs/${slug}`;
  }

  // Group pages by section. Within each, keep the source ordering
  // (already sorted by position then createdAt server-side).
  // Sections themselves sort alphabetically — the convention is to
  // prefix with "Part I: …" / "Part II: …" so they bubble in
  // outline order.
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? pages.filter((p) => p.title.toLowerCase().includes(q))
      : pages;
    const buckets = new Map<string, PageMeta[]>();
    for (const p of filtered) {
      const key = p.section?.trim() || UNCATEGORIZED;
      const arr = buckets.get(key);
      if (arr) arr.push(p);
      else buckets.set(key, [p]);
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
  }, [pages, search]);

  // Sections that contain the active page should always render
  // open, even if the user's collapsed state had them folded.
  const activeSection = useMemo(() => {
    const activePage = pages.find((p) => activeMatch(p.slug));
    return activePage?.section?.trim() || (activePage ? UNCATEGORIZED : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, pathname]);

  // Collect existing section names for the create-page form's
  // datalist suggestions.
  const knownSections = useMemo(() => {
    const set = new Set<string>();
    for (const p of pages) if (p.section) set.add(p.section);
    return Array.from(set).sort();
  }, [pages]);

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/docs/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          section: newSection.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.error === "string" ? data.error : "Couldn't create page.",
        );
        return;
      }
      const { page } = await res.json();
      setNewTitle("");
      setNewSection("");
      setCreating(false);
      router.push(`/docs/${page.slug}`);
      router.refresh();
    });
  }

  return (
    <nav className="space-y-4 text-sm md:sticky md:top-20 md:self-start">
      <div className="relative">
        <Search
          size={13}
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter pages…"
          className="h-8 w-full rounded-md border bg-background pl-7 pr-2 text-xs shadow-sm transition-[color,box-shadow] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between px-2 text-[10px] font-medium text-muted-foreground">
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
              className="h-8 w-full rounded-md border bg-background px-2 text-xs shadow-sm transition-[color,box-shadow] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <input
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              list="docs-section-list"
              placeholder="Section (optional)"
              maxLength={120}
              className="h-8 w-full rounded-md border bg-background px-2 text-xs shadow-sm transition-[color,box-shadow] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <datalist id="docs-section-list">
              {knownSections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={pending || !newTitle.trim()}
                className="inline-flex h-7 items-center rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {pending ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewTitle("");
                  setNewSection("");
                  setError(null);
                }}
                className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
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
        ) : sections.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            No matches for &ldquo;{search.trim()}&rdquo;.
          </p>
        ) : (
          <div className="space-y-2">
            {sections.map(([sectionName, sectionPages]) => {
              const isCollapsed =
                collapsed.has(sectionName) && sectionName !== activeSection;
              return (
                <div key={sectionName} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection(sectionName)}
                    className="flex w-full items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    {isCollapsed ? (
                      <ChevronRight size={12} aria-hidden />
                    ) : (
                      <ChevronDown size={12} aria-hidden />
                    )}
                    <span className="truncate">
                      {sectionName === UNCATEGORIZED
                        ? "Other"
                        : sectionName}
                    </span>
                    <span className="ml-auto text-[10px] font-normal lowercase text-muted-foreground/70">
                      {sectionPages.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <ul className="space-y-0.5 pl-3">
                      {sectionPages.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/docs/${p.slug}`}
                            className={`block rounded-md border-l px-2 py-1.5 text-[13px] transition-colors ${
                              activeMatch(p.slug)
                                ? "border-primary bg-secondary font-medium text-foreground"
                                : "border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                            }`}
                          >
                            {p.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-1 border-t pt-4">
        <div className="px-2 text-[10px] font-medium text-muted-foreground">
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
