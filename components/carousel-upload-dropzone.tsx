"use client";

import { useState, useTransition } from "react";
import JSZip from "jszip";
import type { ResolvedEntity } from "@/types/entity";

export interface CarouselSlide {
  filename: string;
  html: string;
}

interface Props {
  onParsed: (
    slides: CarouselSlide[],
    entities: ResolvedEntity[],
    zipName: string | null,
  ) => void;
}

const MAX_ZIP_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_SLIDES = 40;
const HTML_PATTERN = /\.html?$/i;

export function CarouselUploadDropzone({ onParsed }: Props) {
  const [filename, setFilename] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function pick(file: File) {
    setError(null);
    if (file.size > MAX_ZIP_BYTES) {
      setError(`Zip is ${(file.size / 1024 / 1024).toFixed(1)} MB; max ${MAX_ZIP_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setFilename(file.name);
    setSize(file.size);
    setPendingFile(file);
  }

  function submit() {
    setError(null);
    if (!pendingFile) {
      setError("Drop a .zip with your slide HTMLs.");
      return;
    }
    startTransition(async () => {
      try {
        const slides = await extractSlides(pendingFile);
        if (slides.length === 0) {
          setError("No .html files found in the zip.");
          return;
        }
        if (slides.length > MAX_SLIDES) {
          setError(`Too many slides (${slides.length}); max ${MAX_SLIDES}.`);
          return;
        }

        const res = await fetch("/api/parse-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slides }),
        });
        if (!res.ok) {
          const raw = await res.text().catch(() => "");
          let detail = raw;
          try {
            const data = JSON.parse(raw);
            if (typeof data?.error === "string") detail = data.error;
            else if (data?.error) detail = JSON.stringify(data.error);
          } catch {
            // raw kept
          }
          setError(detail.trim().slice(0, 500) || `Parse failed (${res.status}).`);
          return;
        }
        const data = (await res.json()) as { entities: ResolvedEntity[] };
        onParsed(slides, data.entities, pendingFile.name);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) pick(file);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-12 text-sm transition-colors ${
          filename
            ? "border-primary/40 bg-primary/5"
            : "border-input hover:border-primary/40 hover:bg-secondary/40"
        }`}
      >
        {filename ? (
          <>
            <span className="font-medium text-foreground">{filename}</span>
            <span className="text-xs text-muted-foreground">
              {((size ?? 0) / 1024).toFixed(1)} KB · click to choose another
            </span>
          </>
        ) : (
          <>
            <span className="text-base font-medium text-foreground">
              Drop a .zip of slide HTMLs
            </span>
            <span className="text-muted-foreground">
              one .html per slide, ordered alphabetically
            </span>
          </>
        )}
        <input
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) pick(file);
          }}
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !pendingFile}
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Reading zip..." : "Upload"}
        </button>
      </div>
    </div>
  );
}

async function extractSlides(file: File): Promise<CarouselSlide[]> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const entries: { path: string; entry: JSZip.JSZipObject }[] = [];
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    // Skip macOS resource forks and hidden files which sometimes ship in
    // zips made on macOS / via the Finder.
    if (path.startsWith("__MACOSX/") || path.split("/").some((p) => p.startsWith("."))) return;
    if (!HTML_PATTERN.test(path)) return;
    entries.push({ path, entry });
  });

  // Sort by basename so 01.html, 02.html, ... order naturally.
  entries.sort((a, b) =>
    basename(a.path).localeCompare(basename(b.path), undefined, { numeric: true }),
  );

  const slides: CarouselSlide[] = [];
  for (const { path, entry } of entries) {
    const html = await entry.async("string");
    if (!html.trim()) continue;
    slides.push({ filename: basename(path), html });
  }
  return slides;
}

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}
