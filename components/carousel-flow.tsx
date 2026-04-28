"use client";

import { useState } from "react";
import type { ResolvedEntity } from "@/types/entity";
import {
  CarouselUploadDropzone,
  type CarouselSlide,
} from "@/components/carousel-upload-dropzone";
import { CarouselEditor } from "@/components/carousel-editor";
import { RenderResult } from "@/components/render-result";

type Stage = "upload" | "edit" | "render";

export function CarouselFlow({ storageReady }: { storageReady: boolean }) {
  const [stage, setStage] = useState<Stage>("upload");
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [zipName, setZipName] = useState<string | null>(null);
  const [entities, setEntities] = useState<ResolvedEntity[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  function reset() {
    setStage("upload");
    setSlides([]);
    setZipName(null);
    setEntities([]);
    setPdfUrl(null);
  }

  if (stage === "render" && pdfUrl) {
    return <RenderResult url={pdfUrl} kind="pdf" onReset={reset} />;
  }

  if (stage === "edit") {
    return (
      <CarouselEditor
        slides={slides}
        entities={entities}
        onEntitiesChange={setEntities}
        onBack={() => setStage("upload")}
        storageReady={storageReady}
        onRendered={async (pdf, totalEntities) => {
          const baseName = zipName?.replace(/\.zip$/i, "") ?? "carousel";
          const form = new FormData();
          form.append("file", pdf, `${baseName}.pdf`);
          form.append("filename", baseName);
          form.append("entity_count", String(totalEntities));

          const res = await fetch("/api/render", { method: "POST", body: form });
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
            const summary = detail.trim().slice(0, 500) || res.statusText || "no response body";
            throw new Error(`PDF upload failed (${res.status}): ${summary}`);
          }
          const data = await res.json();
          setPdfUrl(data.png_url);
          setStage("render");
        }}
      />
    );
  }

  return (
    <CarouselUploadDropzone
      onParsed={(parsedSlides, parsedEntities, name) => {
        setSlides(parsedSlides);
        setZipName(name);
        setEntities(parsedEntities);
        setStage("edit");
      }}
    />
  );
}
