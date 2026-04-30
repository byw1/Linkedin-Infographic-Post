"use client";

import { ExternalLink, Plus, Search, Upload, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { TagInput } from "@/components/ui/tag-input";

interface Tool {
  id: string;
  name: string;
  url: string;
  description: string | null;
  category: string | null;
  tags: string[];
  logoUrl: string | null;
}

interface Props {
  // Admin viewers see inline + Add tool / Edit / Delete affordances.
  // Member viewers just browse.
  isAdmin: boolean;
}

// Member-facing tools catalog with optional admin actions. Cards
// group by category (one tool per section — its primary category).
// Tags stay on the card as chips. Search above filters everything.
//
// Admin controls live inline on this page rather than a separate
// /admin/tools surface — there's no value in two places to look at
// the same list when the only difference is who can edit.
export function ToolsBrowser({ isAdmin }: Props) {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/tools");
    if (!res.ok) return;
    const data = await res.json();
    setTools(data.tools);
  }

  useEffect(() => {
    void load();
  }, []);

  // Aggregate every tag / category in use — feeds suggestion lists
  // in the form so admins reuse what already exists instead of
  // inventing parallels (Outreach vs outreach vs Outreach Tools).
  const allKnownTags = useMemo(() => {
    if (!tools) return [];
    const set = new Set<string>();
    for (const t of tools) for (const tag of t.tags) set.add(tag);
    return Array.from(set).sort();
  }, [tools]);

  const allKnownCategories = useMemo(() => {
    if (!tools) return [];
    const set = new Set<string>();
    for (const t of tools) if (t.category) set.add(t.category);
    return Array.from(set).sort();
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
        if (t.category?.toLowerCase().includes(q)) return true;
        for (const tag of t.tags) if (tag.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    return out;
  }, [tools, search, activeTag]);

  // Group visible tools by category. Each tool sits in exactly
  // one section (its primary category, or "Uncategorized" for
  // tools without one). Within a section, alphabetical by name.
  const sections = useMemo(() => {
    if (!visible) return [];
    const buckets = new Map<string, Tool[]>();
    for (const t of visible) {
      const key = t.category?.trim() || "Uncategorized";
      push(buckets, key, t);
    }
    const ordered = Array.from(buckets.entries()).sort(([a], [b]) => {
      // Uncategorized sorts to the end — it's the catch-all, not
      // a real category.
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
    return ordered.map(([category, items]) => ({
      category,
      items: items.sort((x, y) => x.name.localeCompare(y.name)),
    }));
  }, [visible]);

  // Tag chip strip uses raw counts from the unfiltered set so the
  // bar stays stable as the user filters.
  const tagCounts = useMemo(() => {
    if (!tools) return [] as [string, number][];
    const counts = new Map<string, number>();
    for (const t of tools) {
      for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [tools]);

  return (
    <div className="space-y-5">
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
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setAdding((v) => !v);
              setEditingId(null);
            }}
            className="inline-flex h-10 items-center gap-1 rounded-md border px-3 text-xs hover:bg-secondary"
          >
            <Plus size={14} aria-hidden />
            {adding ? "Cancel" : "Add tool"}
          </button>
        )}
      </div>

      {tagCounts.length > 0 && (
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
          {tagCounts.map(([tag, count]) => (
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

      {adding && isAdmin && (
        <ToolForm
          mode="create"
          allKnownTags={allKnownTags}
          allKnownCategories={allKnownCategories}
          onSaved={() => {
            setAdding(false);
            void load();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {visible === null && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {visible && visible.length === 0 && (
        <div className="rounded-md border-2 border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          {search || activeTag
            ? "No tools match that filter. Try a wider search."
            : isAdmin
              ? "Catalog is empty. Hit Add tool above to seed the first one."
              : "Catalog is empty — ask an admin to seed it."}
        </div>
      )}

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.category} className="space-y-3">
            <h3 className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{section.category}</span>
              <span className="text-[10px] font-normal lowercase text-muted-foreground/70">
                {section.items.length}
              </span>
            </h3>
            <motion.div
              layout
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {section.items.map((t) =>
                  editingId === t.id ? (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="sm:col-span-2 lg:col-span-3"
                    >
                      <ToolForm
                        mode="edit"
                        initial={t}
                        allKnownTags={allKnownTags}
                        allKnownCategories={allKnownCategories}
                        onSaved={() => {
                          setEditingId(null);
                          void load();
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </motion.div>
                  ) : (
                    <ToolCard
                      key={t.id}
                      tool={t}
                      isAdmin={isAdmin}
                      onEdit={() => setEditingId(t.id)}
                      onDeleted={() => void load()}
                    />
                  ),
                )}
              </AnimatePresence>
            </motion.div>
          </section>
        ))}
      </div>
    </div>
  );
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

function ToolCard({
  tool,
  isAdmin,
  onEdit,
  onDeleted,
}: {
  tool: Tool;
  isAdmin: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`Delete ${tool.name}?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/tools/${tool.id}`, {
        method: "DELETE",
      });
      if (res.ok) onDeleted();
    });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-shadow duration-300 hover:shadow-lg"
    >
      <a
        href={tool.url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0"
        aria-label={tool.name}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 transition-colors duration-500 group-hover:from-primary/5 group-hover:to-primary/10" />

      <div className="relative flex items-start gap-3">
        <ToolLogo tool={tool} size={44} />
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

      {isAdmin && (
        <div className="relative z-10 mt-auto flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              onEdit();
            }}
            className="inline-flex h-7 items-center rounded-md border bg-card/80 px-2.5 text-[11px] backdrop-blur hover:bg-secondary"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              remove();
            }}
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md border border-destructive/40 bg-card/80 px-2.5 text-[11px] text-destructive backdrop-blur hover:bg-destructive/10 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}
    </motion.div>
  );
}

function ToolLogo({ tool, size = 44 }: { tool: Tool; size?: number }) {
  const src = tool.logoUrl ?? faviconUrl(tool.url);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-lg border bg-secondary object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold uppercase text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {tool.name.charAt(0)}
    </div>
  );
}

// Tool creation / edit form. Inline within the catalog so admins
// don't context-switch — single source of truth for browsing and
// editing.
function ToolForm({
  mode,
  initial,
  allKnownTags,
  allKnownCategories,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: Tool;
  allKnownTags: string[];
  allKnownCategories: string[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  // Local logo state so the preview reflects upload-in-progress
  // before the parent re-fetches. Seeded from the initial row.
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logoUrl ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Stable preview tool used by the logo widget — synthesizes the
  // bits the live ToolLogo needs so we can show favicon /
  // uploaded preview without round-tripping the parent.
  const previewTool: Tool = {
    id: initial?.id ?? "",
    name: name || "?",
    url: url || "https://example.com",
    description: null,
    category: null,
    tags: [],
    logoUrl,
  };

  async function uploadLogoTo(toolId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/admin/tools/${toolId}/logo`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        typeof data.error === "string" ? data.error : "Logo upload failed.",
      );
    }
    const data = await res.json();
    return data.logoUrl as string;
  }

  function save() {
    setError(null);
    const body: Record<string, unknown> = {
      name: name.trim(),
      url: url.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      logoUrl,
      tags,
    };

    startTransition(async () => {
      try {
        // Upsert text fields first; the new id is used as the upload
        // target so we stash the file under tools/<id>-...
        const path =
          mode === "create"
            ? "/api/admin/tools"
            : `/api/admin/tools/${initial!.id}`;
        const method = mode === "create" ? "POST" : "PATCH";
        const res = await fetch(path, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            typeof data.error === "string" ? data.error : "Save failed.",
          );
        }
        const out = await res.json();
        const toolId = out.tool?.id as string;

        // Then ship the logo file if the admin attached one. Two-
        // step keeps the API simple (JSON for text, multipart for
        // bytes) and avoids fighting Next's route handler with mixed
        // content types.
        if (logoFile && toolId) {
          await uploadLogoTo(toolId, logoFile);
        }
        onSaved();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  async function clearStoredLogo() {
    if (!initial) {
      // Create-mode: just discard the locally-staged file.
      setLogoFile(null);
      setLogoUrl(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (!confirm("Remove the uploaded logo and revert to the favicon?")) return;
    const res = await fetch(`/api/admin/tools/${initial.id}/logo`, {
      method: "DELETE",
    });
    if (res.ok) {
      setLogoUrl(null);
      setLogoFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-md border-2 border-dashed bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {mode === "create" ? "New tool" : `Editing ${initial?.name}`}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder="HeyReach"
        />
        <Field
          label="URL"
          value={url}
          onChange={setUrl}
          placeholder="https://heyreach.io"
        />
      </div>
      <label className="block text-sm">
        <span className="block text-[11px] text-muted-foreground">
          Description
        </span>
        <textarea
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="What it does, in a sentence or two."
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="block text-[11px] text-muted-foreground">
            Category{" "}
            <span className="text-muted-foreground/70">
              (drives sectioning)
            </span>
          </span>
          <input
            value={category}
            onChange={(ev) => setCategory(ev.target.value)}
            list="tool-category-list"
            placeholder="Outreach, Scheduling, Analytics…"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          />
          <datalist id="tool-category-list">
            {allKnownCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm">
          <span className="block text-[11px] text-muted-foreground">Tags</span>
          <TagInput
            value={tags}
            onChange={setTags}
            suggestions={allKnownTags}
            placeholder="automation, outreach…"
          />
        </label>
      </div>

      <LogoField
        tool={previewTool}
        hasUpload={Boolean(logoUrl)}
        onPick={(file) => {
          setLogoFile(file);
          // Show a local preview right away — once submitted, the
          // server's stored URL will replace this.
          const reader = new FileReader();
          reader.onload = () => setLogoUrl(String(reader.result));
          reader.readAsDataURL(file);
        }}
        onClear={clearStoredLogo}
        fileRef={fileRef}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-md border px-4 text-xs hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function LogoField({
  tool,
  hasUpload,
  onPick,
  onClear,
  fileRef,
}: {
  tool: Tool;
  hasUpload: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
  fileRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] text-muted-foreground">
        Logo{" "}
        <span className="text-muted-foreground/70">
          (defaults to the site&apos;s favicon — upload to override)
        </span>
      </span>
      <div className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
        <ToolLogo tool={tool} size={48} />
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs hover:bg-secondary"
          >
            <Upload size={12} aria-hidden />
            {hasUpload ? "Replace" : "Upload"}
          </button>
          {hasUpload && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10"
            >
              <X size={12} aria-hidden />
              Use favicon
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) onPick(f);
            }}
            className="hidden"
          />
          <span className="text-[10px] text-muted-foreground">
            PNG / JPG / WebP / SVG / GIF · 2 MB max
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
      />
    </label>
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

// Use Google's favicon service as the default logo — it returns a
// 128px raster that reads cleanly at our 44px display size and
// falls back to a generic globe glyph if the site has no favicon.
function faviconUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.host}&sz=128`;
  } catch {
    return null;
  }
}
