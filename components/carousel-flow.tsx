"use client";

import { useState } from "react";
import type { ResolvedEntity } from "@/types/entity";
import {
  CarouselUploadDropzone,
  type CarouselSlide,
} from "@/components/carousel-upload-dropzone";
import { CarouselEditor } from "@/components/carousel-editor";
import { RenderPoller } from "@/components/render-poller";
import { RenderResult } from "@/components/render-result";

type Stage = "upload" | "edit" | "rendering" | "render";

export function CarouselFlow({ storageReady }: { storageReady: boolean }) {
  const [stage, setStage] = useState<Stage>("upload");
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [zipName, setZipName] = useState<string | null>(null);
  const [entities, setEntities] = useState<ResolvedEntity[]>([]);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  function reset() {
    setStage("upload");
    setSlides([]);
    setZipName(null);
    setEntities([]);
    setRenderId(null);
    setPdfUrl(null);
    setRenderError(null);
  }

  async function submitRender(mapping: Record<string, string>) {
    setRenderError(null);
    const baseName = zipName?.replace(/\.zip$/i, "") ?? "carousel";
    const res = await fetch("/api/render-carousel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slides,
        mapping,
        filename: baseName,
      }),
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
      const summary = detail.trim().slice(0, 500) || res.statusText || "no response body";
      throw new Error(`Render request failed (${res.status}): ${summary}`);
    }
    const data = await res.json();
    setRenderId(data.render_id);
    setStage("rendering");
  }

  if (stage === "render" && pdfUrl) {
    return <RenderResult url={pdfUrl} kind="pdf" onReset={reset} />;
  }

  if (stage === "rendering" && renderId) {
    return (
      <div className="space-y-3">
        <RenderPoller
          renderId={renderId}
          message={`Rendering ${slides.length} slide${slides.length === 1 ? "" : "s"} as a real-text PDF — about 2-3 seconds per slide.`}
          onComplete={(url) => {
            setPdfUrl(url);
            setStage("render");
          }}
          onFailed={(message) => {
            setRenderError(message);
            setStage("edit");
          }}
          onCancel={() => {
            // Just stop polling and go back to the editor — the worker
            // job continues in the background and the row stays in the
            // history if that ever becomes useful.
            setStage("edit");
          }}
        />
      </div>
    );
  }

  if (stage === "edit") {
    return (
      <div className="space-y-3">
        {renderError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {renderError}
          </div>
        )}
        <CarouselEditor
          slides={slides}
          entities={entities}
          onEntitiesChange={setEntities}
          onBack={() => setStage("upload")}
          storageReady={storageReady}
          onSubmit={submitRender}
        />
      </div>
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
