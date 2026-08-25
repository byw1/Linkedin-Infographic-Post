"use client";

import { useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import type { ResolvedEntity } from "@/types/entity";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  onParsed: (entities: ResolvedEntity[], html: string, filename: string | null) => void;
}

// Pull the data-entity slugs out of the pasted source so we can show a
// live count before the round-trip to /api/parse. Deliberately a regex
// and not DOMParser — this runs on every keystroke and only needs to be
// right about attribute syntax, which the server re-validates anyway.
const ENTITY_RE = /data-entity\s*=\s*["']([^"']+)["']/gi;

function findEntities(html: string): string[] {
  const seen = new Set<string>();
  for (const m of html.matchAll(ENTITY_RE)) {
    const slug = m[1]?.trim();
    if (slug) seen.add(slug);
  }
  return [...seen];
}

/**
 * Source input for the infographic flow. Pasting is the overwhelmingly
 * common path — you copy the HTML out of Claude and drop it straight in
 * — so the textarea *is* the surface, and file-drop is an overlay on top
 * of it rather than a competing box above it.
 */
export function UploadDropzone({ onParsed }: Props) {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Drag events fire per-child; a depth counter stops the overlay
  // flickering as the pointer crosses the textarea inside the drop zone.
  const dragDepth = useRef(0);

  const entities = useMemo(() => findEntities(text), [text]);
  const kb = text.length / 1024;

  // Focus on mount so landing here and hitting paste just works — but
  // `preventScroll`, because the plain autoFocus attribute scrolls the
  // textarea into view and takes the page header (and the walkthrough
  // above it) off the top of the screen.
  useLayoutEffect(() => {
    taRef.current?.focus({ preventScroll: true });
  }, []);

  // Grow to fit the pasted source instead of reserving a fixed slab of
  // empty space. Starts at MIN_H so the empty state stays compact, and
  // caps at MAX_H so a 2,000-line file doesn't push the actions off
  // screen — past that the textarea scrolls internally.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const MIN_H = 160;
    const MAX_H = 460;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, MIN_H), MAX_H)}px`;
  }, [text]);

  function readFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setFilename(file.name);
    };
    reader.readAsText(file);
  }

  function clear() {
    setText("");
    setFilename(null);
    setError(null);
  }

  function submit() {
    setError(null);
    if (!text.trim()) {
      setError("Paste your HTML above, or drop an .html file in.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Upload failed.");
        return;
      }
      const data = await res.json();
      onParsed(data.entities, text, filename);
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Paste your HTML</CardTitle>
        <CardDescription>
          Copy the file Claude generated and paste it in — or drop an .html file
          anywhere on this box.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp />
            Browse
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        <div
          className="relative"
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => {
            dragDepth.current -= 1;
            if (dragDepth.current <= 0) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) readFile(file);
          }}
        >
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // Once you hand-edit, the filename no longer describes
              // what's in the box.
              if (filename) setFilename(null);
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
            spellCheck={false}
            placeholder={'<div data-entity="tesla" style="width:64px;height:64px"></div>'}
            className={cn(
              "block w-full resize-none overflow-auto rounded-md border border-input bg-transparent p-3 font-mono text-xs leading-relaxed shadow-sm outline-none ring-offset-0 transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
              dragging && "border-ring ring-[3px] ring-ring/50",
            )}
          />

          {dragging && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-accent/80 text-sm font-medium">
              Drop to load the file
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".html,text/html"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
              // Reset so picking the same file twice still fires.
              e.target.value = "";
            }}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {text.trim() ? (
              <>
                {filename && (
                  <span className="truncate font-medium text-foreground">
                    {filename}
                  </span>
                )}
                <span className="tabular-nums">{kb.toFixed(1)} KB</span>
                <span className="tabular-nums">
                  {entities.length} placeholder{entities.length === 1 ? "" : "s"}
                </span>
                {entities.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    {entities.slice(0, 6).map((slug) => (
                      <span
                        key={slug}
                        className="inline-flex items-center rounded-full border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-foreground"
                      >
                        {slug}
                      </span>
                    ))}
                    {entities.length > 6 && (
                      <span className="tabular-nums">+{entities.length - 6}</span>
                    )}
                  </span>
                )}
              </>
            ) : (
              <span>Nothing pasted yet.</span>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {text.trim() && !pending && (
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                <X />
                Clear
              </Button>
            )}
            <Button type="button" onClick={submit} disabled={pending || !text.trim()}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? "Parsing…" : "Continue"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
