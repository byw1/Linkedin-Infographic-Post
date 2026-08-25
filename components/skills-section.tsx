"use client";

import { useEffect, useState, useTransition } from "react";

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

export function SkillsSection({ canManage }: { canManage: boolean }) {
  const [skills, setSkills] = useState<Skill[] | null>(null);

  async function load() {
    const res = await fetch("/api/skills");
    if (!res.ok) return;
    const data = await res.json();
    setSkills(data.skills);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="space-y-6">
      <Intro />
      <HowToUse />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Available skills</h3>
          {skills && skills.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {skills.length} skill{skills.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {skills === null && (
          <p className="border bg-card p-6 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {skills && skills.length === 0 && (
          <div className="border bg-card p-8 text-center text-card-foreground">
            <p className="text-sm font-medium">No skills yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canManage
                ? "Upload one below to share with the team."
                : "Ask an admin to upload one."}
            </p>
          </div>
        )}
        {skills && skills.length > 0 && (
          <div className="space-y-3">
            {skills.map((s) => (
              <SkillCard
                key={s.id}
                skill={s}
                canManage={canManage}
                onChange={() => void load()}
              />
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <div className="space-y-3 border-t pt-6">
          <h3 className="text-lg font-semibold">Upload a new skill</h3>
          <UploadForm onUploaded={() => void load()} />
        </div>
      )}
    </section>
  );
}

function Intro() {
  return (
    <div className="border bg-card p-5 text-card-foreground">
      <h3 className="text-base font-semibold">What's a skill?</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        A skill is a pre-written guide that tells Claude exactly how to make
        your LinkedIn posts — the design system, the writing style, the
        sections, the formatting. Download one, paste it into Claude, then ask
        Claude to make a post. Claude follows the recipe; you drop the result
        into <strong className="text-foreground">New post</strong> to render and
        publish.
      </p>
    </div>
  );
}

function HowToUse() {
  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: "Pick a skill below and click Copy markdown",
      body: (
        <>
          The whole skill text lands on your clipboard. Or click{" "}
          <strong>Download</strong> if you'd rather save it as a{" "}
          <code>.md</code> file.
        </>
      ),
    },
    {
      title: "Open Claude and start a new Project",
      body: (
        <>
          Go to{" "}
          <a
            href="https://claude.ai/projects"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            claude.ai/projects
          </a>{" "}
          → <strong>Create project</strong>. (Claude Code users: drop the file
          at{" "}
          <code className="text-xs">
            ~/.claude/skills/&lt;name&gt;/SKILL.md
          </code>{" "}
          instead.)
        </>
      ),
    },
    {
      title: 'Click "Custom instructions" and paste the markdown',
      body: (
        <>Save. Claude now knows the recipe for every chat in this project.</>
      ),
    },
    {
      title: "Ask Claude to make a post",
      body: (
        <>
          Something like &quot;
          <em>Make me a single LinkedIn post about [news topic]</em>.&quot;
          Claude will search the web, write the post body, and produce a
          1080×1350 HTML file.
        </>
      ),
    },
    {
      title: "Bring the HTML back here",
      body: (
        <>
          Open <strong>New post</strong>, drop the HTML, swap in real logos from
          the library, render the PNG / PDF, post it on LinkedIn.
        </>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">How to use a skill</h3>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li
            key={i}
            className="flex gap-3 border bg-card p-3 text-sm text-card-foreground"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <div className="space-y-0.5">
              <div className="font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SkillCard({
  skill,
  canManage,
  onChange,
}: {
  skill: Skill;
  canManage: boolean;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // "idle" | "copying" | "copied" | "error" — drives the Copy
  // button's transient label so the user gets immediate feedback
  // instead of having to check their clipboard.
  const [copyState, setCopyState] = useState<
    "idle" | "copying" | "copied" | "error"
  >("idle");

  async function copyMarkdown() {
    setCopyState("copying");
    try {
      const res = await fetch(`/api/skills/${skill.id}/download`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1800);
    }
  }

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
      const res = await fetch(`/api/admin/skills/${skill.id}`, {
        method: "DELETE",
      });
      if (res.ok) onChange();
    });
  }

  const copyLabel =
    copyState === "copying"
      ? "Copying…"
      : copyState === "copied"
        ? "Copied ✓"
        : copyState === "error"
          ? "Copy failed"
          : "Copy markdown";

  return (
    <div className="border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full border bg-background px-3 text-base font-semibold outline-none focus-visible:border-ring"
            />
          ) : (
            <h4 className="text-base font-semibold leading-tight">
              {skill.name}
            </h4>
          )}
          {editing ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="When to use this skill, what it produces, etc."
              className="w-full border bg-background px-2 py-1.5 text-sm outline-none focus-visible:border-ring"
            />
          ) : (
            skill.description && (
              <p className="text-sm text-muted-foreground">
                {skill.description}
              </p>
            )
          )}
          <div className="text-[11px] text-muted-foreground">
            {(skill.fileSize / 1024).toFixed(1)} KB · uploaded{" "}
            {new Date(skill.createdAt).toLocaleDateString()} by{" "}
            {skill.uploadedBy.name ?? skill.uploadedBy.email}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!editing && (
            <>
              <button
                type="button"
                onClick={() => void copyMarkdown()}
                disabled={copyState === "copying"}
                className={`inline-flex h-9 items-center px-3 text-xs font-medium disabled:opacity-50 ${
                  copyState === "copied"
                    ? "border border-foreground/30 bg-accent text-foreground"
                    : copyState === "error"
                      ? "border border-destructive/40 bg-destructive/10 text-destructive"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {copyLabel}
              </button>
              <a
                href={`/api/skills/${skill.id}/download`}
                download={skill.filename}
                className="inline-flex h-9 items-center border px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none focus-visible:border-ring"
              >
                Download
              </a>
            </>
          )}
          {canManage && (
            <>
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={save}
                    disabled={pending}
                    className="inline-flex h-9 items-center bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="inline-flex h-9 items-center border px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none focus-visible:border-ring"
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
                    className="inline-flex h-9 items-center border px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none focus-visible:border-ring"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={pending}
                    className="inline-flex h-9 items-center border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
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
      const res = await fetch("/api/admin/skills", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.error === "string" ? data.error : "Upload failed.",
        );
        return;
      }
      onUploaded();
    });
  }

  return (
    <div className="space-y-2 border bg-card p-4 text-card-foreground">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-1 py-6 text-sm text-muted-foreground hover:bg-accent/50"
      >
        <span className="font-medium text-foreground">
          Drop a .md skill file here
        </span>
        <span className="text-xs">
          or click to pick one — name + description come from the YAML
          frontmatter
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
