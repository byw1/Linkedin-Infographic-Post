"use client";

import { useEffect, useState, useTransition } from "react";
import { getStoredThemeId } from "@/components/theme-picker";

interface Skill {
  id: string;
  name: string;
  description: string | null;
  filename: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  uploadedBy: { id: string; name: string | null; email: string };
  downloadUrl: string;
}

interface ThemeOption {
  id: string;
  name: string;
  isOfficial: boolean;
}

export function SkillsSection({ canManage }: { canManage: boolean }) {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  // Active theme for download injection. Defaults to whatever the
  // editor picker last persisted; "" means "no theme" (raw skill).
  const [themeId, setThemeId] = useState<string>("");

  async function load() {
    const res = await fetch("/api/skills");
    if (!res.ok) return;
    const data = await res.json();
    setSkills(data.skills);
  }

  async function loadThemes() {
    const res = await fetch("/api/themes");
    if (!res.ok) return;
    const data = await res.json();
    setThemes(data.themes);
    const stored = getStoredThemeId();
    if (stored && data.themes.some((t: ThemeOption) => t.id === stored)) {
      setThemeId(stored);
    } else {
      const official = data.themes.find((t: ThemeOption) => t.isOfficial);
      if (official) setThemeId(official.id);
    }
  }

  useEffect(() => {
    void load();
    void loadThemes();
  }, []);

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Download a skill, paste into Claude (Project custom instructions, or{" "}
        <code>~/.claude/skills/&lt;name&gt;/SKILL.md</code> for Claude Code) —
        then ask Claude to build the infographic or carousel and drop the
        result back into <strong>New post</strong>.
      </p>

      {themes.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <label
            htmlFor="skill-theme"
            className="font-medium uppercase tracking-wide text-muted-foreground"
          >
            Append theme
          </label>
          <select
            id="skill-theme"
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">None (raw skill)</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isOfficial ? " · official" : ""}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">
            — bakes brand tokens into the download.
          </span>
        </div>
      )}

      {skills === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {skills && skills.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "No skills uploaded yet. Use the form below to add one."
            : "No skills uploaded yet. Ask an admin to add one."}
        </p>
      )}
      {skills && skills.length > 0 && (
        <div className="space-y-2">
          {skills.map((s) => (
            <SkillRow
              key={s.id}
              skill={s}
              themeId={themeId || null}
              canManage={canManage}
              onChange={() => void load()}
            />
          ))}
        </div>
      )}

      {canManage && <UploadForm onUploaded={() => void load()} />}
    </section>
  );
}

function SkillRow({
  skill,
  themeId,
  canManage,
  onChange,
}: {
  skill: Skill;
  themeId: string | null;
  canManage: boolean;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || skill.name,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      setEditing(false);
      onChange();
    });
  }

  function remove() {
    if (!confirm(`Delete skill "${skill.name}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/skills/${skill.id}`, { method: "DELETE" });
      if (res.ok) onChange();
    });
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm font-medium"
            />
          ) : (
            <div className="font-mono text-sm font-medium">{skill.name}</div>
          )}
          {editing ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="When to use this skill, what it produces, etc."
              className="w-full rounded-md border bg-background px-2 py-1 text-xs"
            />
          ) : (
            skill.description && (
              <p className="text-xs text-muted-foreground">{skill.description}</p>
            )
          )}
          <div className="text-[11px] text-muted-foreground">
            {skill.filename} · {(skill.fileSize / 1024).toFixed(1)} KB · uploaded{" "}
            {new Date(skill.createdAt).toLocaleDateString()} by{" "}
            {skill.uploadedBy.name ?? skill.uploadedBy.email}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            // Route through the in-app download endpoint so the active
            // theme's tokens get appended in-line. Falls back to the
            // raw S3 URL when no theme is selected — same bytes either
            // way, but skips the proxy hop.
            href={
              themeId
                ? `/api/skills/${skill.id}/download?themeId=${themeId}`
                : `/api/skills/${skill.id}/download`
            }
            download={skill.filename}
            className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
          >
            Download
          </a>
          {canManage && (
            <>
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={save}
                    disabled={pending}
                    className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setName(skill.name);
                      setDescription(skill.description ?? "");
                      setEditing(true);
                    }}
                    className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={pending}
                    className="inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setError(null);
    const form = new FormData();
    form.append("file", file);
    startTransition(async () => {
      const res = await fetch("/api/admin/skills", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Upload failed.");
        return;
      }
      onUploaded();
    });
  }

  return (
    <div className="space-y-2 rounded-md border-2 border-dashed p-3">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-1 py-4 text-sm text-muted-foreground hover:bg-secondary/40"
      >
        <span className="font-medium text-foreground">Upload a .md skill file</span>
        <span className="text-xs">
          drop or click — name + description are pulled from the YAML frontmatter
        </span>
        <input
          type="file"
          accept=".md,.markdown,text/markdown"
          disabled={pending}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {pending && <p className="text-xs text-muted-foreground">Uploading…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
