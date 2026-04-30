"use client";

import { ExternalLink, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

interface Tool {
  id: string;
  name: string;
  url: string;
  description: string | null;
  tags: string[];
  logoUrl: string | null;
}

// Member-facing browser for the admin-curated tools catalog.
// Search box at top filters by name + description + tags. Tag
// chips below the search add a single-tag filter on top of the
// text query — click again to clear.
//
// Cards animate in via framer-motion on first load and re-shuffle
// (with FLIP-style transitions courtesy of `layout`) whenever the
// filter results change. Each card lifts on hover.
export function ToolsBrowser() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/tools");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setTools(data.tools);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tag aggregation for the chip strip — counts so frequent tags
  // surface first, like the members page.
  const allTags = useMemo(() => {
    if (!tools) return [];
    const counts = new Map<string, number>();
    for (const t of tools) {
      for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [tools]);

  const visible = useMemo(() => {
    if (!tools) return null;
    const q = search.trim().toLowerCase();
    let out = tools;
    if (activeTag) out = out.filter((t) => t.tags.includes(activeTag));
    if (q) {
      out = out.filter((t) => {
        if (t.name.toLowerCase().includes(q)) return true;
        if (t.description?.toLowerCase().includes(q)) return true;
        if (t.url.toLowerCase().includes(q)) return true;
        for (const tag of t.tags) if (tag.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    return out;
  }, [tools, search, activeTag]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            placeholder="Search tools, tags, descriptions…"
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        {tools && (
          <span className="text-xs text-muted-foreground">
            {visible?.length ?? 0} / {tools.length}
          </span>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`inline-flex h-7 items-center rounded-full border px-3 text-xs ${
              activeTag === null
                ? "border-primary bg-primary/10"
                : "hover:bg-secondary"
            }`}
          >
            All
          </button>
          {allTags.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag === activeTag ? null : tag)}
              className={`inline-flex h-7 items-center gap-1 rounded-full border px-3 font-mono text-xs ${
                tag === activeTag
                  ? "border-primary bg-primary/10"
                  : "hover:bg-secondary"
              }`}
            >
              {tag}
              <span className="text-muted-foreground">{count}</span>
            </button>
          ))}
        </div>
      )}

      {visible === null && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {visible && visible.length === 0 && (
        <div className="rounded-md border-2 border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          {search || activeTag
            ? "No tools match that filter. Try a wider search."
            : "Catalog is empty — ask an admin to seed it."}
        </div>
      )}
      <motion.div
        layout
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <AnimatePresence mode="popLayout">
          {visible?.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <motion.a
      layout
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{
        y: -4,
        transition: { duration: 0.18 },
      }}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-shadow duration-300 hover:shadow-lg"
    >
      {/* Subtle gradient sheen on hover for the "feels alive" cue. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 transition-colors duration-500 group-hover:from-primary/5 group-hover:to-primary/10" />

      <div className="relative flex items-start gap-3">
        {tool.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={tool.logoUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-lg border bg-secondary object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-semibold uppercase text-white">
            {tool.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{tool.name}</span>
            <ExternalLink
              size={12}
              aria-hidden
              className="shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </div>
          <span className="truncate text-[11px] text-muted-foreground">
            {prettyHost(tool.url)}
          </span>
        </div>
      </div>

      {tool.description && (
        <p className="relative line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {tool.description}
        </p>
      )}

      {tool.tags.length > 0 && (
        <div className="relative mt-auto flex flex-wrap gap-1">
          {tool.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex h-5 items-center rounded-full border bg-secondary/50 px-2 font-mono text-[10px]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.a>
  );
}

// Strip protocol + trailing slash for compact display under the
// tool name. Falls back to the raw URL if parsing fails.
function prettyHost(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
}
