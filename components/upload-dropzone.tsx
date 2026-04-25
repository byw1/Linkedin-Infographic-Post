"use client";

import { useState, useTransition } from "react";
import type { ResolvedEntity } from "@/types/entity";

interface Props {
  onParsed: (entities: ResolvedEntity[], html: string, filename: string | null) => void;
}

export function UploadDropzone({ onParsed }: Props) {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setFilename(file.name);
    };
    reader.readAsText(file);
  }

  function submit() {
    setError(null);
    if (!text.trim()) {
      setError("Paste some HTML or drop a file first.");
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
        setError(typeof data.error === "string" ? data.error : "Parse failed.");
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
        className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed p-8 text-sm text-muted-foreground hover:bg-secondary/40"
      >
        <span className="font-medium text-foreground">Drop an .html file</span>
        <span>or click to browse · or paste below</span>
        <input
          type="file"
          accept=".html,text/html"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
          }}
        />
        {filename && <span className="text-xs">{filename}</span>}
      </label>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="<div data-entity='tesla' style='width:64px;height:64px;border-radius:8px;background:#0f0;'></div>"
        rows={10}
        spellCheck={false}
        className="w-full rounded-md border bg-background p-3 font-mono text-xs"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Parsing..." : "Parse"}
        </button>
      </div>
    </div>
  );
}
