"use client";

import { useState, useTransition } from "react";
import type { ResolvedEntity } from "@/types/entity";

interface Props {
  onParsed: (entities: ResolvedEntity[], html: string, filename: string | null) => void;
}

export function UploadDropzone({ onParsed }: Props) {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function readFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setText(content);
      setFilename(file.name);
    };
    reader.readAsText(file);
  }

  function submit() {
    setError(null);
    if (!text.trim()) {
      setError("Drop an .html file or paste HTML below.");
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
    <div className="space-y-4">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-12 text-sm transition-all duration-200 ${
          filename
            ? "border-foreground/30 bg-accent/50"
            : "border-input hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-accent/50 hover:shadow-md"
        }`}
      >
        {filename ? (
          <>
            <span className="font-medium text-foreground">{filename}</span>
            <span className="text-xs text-muted-foreground">
              {(text.length / 1024).toFixed(1)} KB · click to choose another
            </span>
          </>
        ) : (
          <>
            <span className="text-base font-medium text-foreground">
              Drop an .html file
            </span>
            <span className="text-muted-foreground">or click to browse</span>
          </>
        )}
        <input
          type="file"
          accept=".html,text/html"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
          }}
        />
      </label>

      <div className="text-xs">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          {showRaw ? "Hide HTML" : "Or paste HTML directly"}
        </button>
      </div>

      {showRaw && (
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value && !filename) setFilename(null);
          }}
          placeholder="<div data-entity='tesla' style='width:64px;height:64px;border-radius:8px;background:#0f0;'></div>"
          rows={10}
          spellCheck={false}
          className="w-full rounded-md border bg-background p-3 font-mono text-xs shadow-sm transition-[color,box-shadow] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !text.trim()}
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {pending ? "Uploading..." : "Upload"}
        </button>
      </div>
    </div>
  );
}
