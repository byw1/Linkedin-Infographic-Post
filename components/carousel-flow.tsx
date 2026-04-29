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
type Format = "pdf" | "png-zip";

interface RenderRecord {
  id: string;
  url: string;
  format: Format;
}

const FORMAT_LABEL: Record<Format, string> = {
  pdf: "PDF",
  "png-zip": "PNG zip",
};

const FORMAT_HINT: Record<Format, string> = {
  pdf: "for LinkedIn document carousels",
  "png-zip": "for Instagram carousels (or anywhere that doesn't take PDFs)",
};

function resultKind(format: Format): "pdf" | "zip" {
  return format === "png-zip" ? "zip" : "pdf";
}

export function CarouselFlow({ storageReady }: { storageReady: boolean }) {
  const [stage, setStage] = useState<Stage>("upload");
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [zipName, setZipName] = useState<string | null>(null);
  const [entities, setEntities] = useState<ResolvedEntity[]>([]);

  // The first render the user produces is the "primary" — its
  // RenderResult panel hosts the Track / Delete affordances. The
  // alternate format (rendered via "Also render as …" after the fact)
  // tags along below as a download-only block.
  const [primary, setPrimary] = useState<RenderRecord | null>(null);
  const [alternate, setAlternate] = useState<RenderRecord | null>(null);

  // Active theme id at the moment the user fires the first render. We
  // remember it so the "Also render as …" button uses the same theme
  // as the primary render rather than picking up whatever the user
  // last selected on /themes between the two renders.
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);

  // The format we're actively polling for — null when we're not
  // rendering anything. Holds the format so the poller copy and the
  // landing slot (primary vs alternate) match what's coming back.
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [pollingFormat, setPollingFormat] = useState<Format | null>(null);

  const [renderError, setRenderError] = useState<string | null>(null);

  function reset() {
    setStage("upload");
    setSlides([]);
    setZipName(null);
    setEntities([]);
    setPrimary(null);
    setAlternate(null);
    setPollingId(null);
    setPollingFormat(null);
    setRenderError(null);
    setActiveThemeId(null);
  }

  function computeMapping(): Record<string, string> {
    const mapping: Record<string, string> = {};
    for (const e of entities) {
      if (e.logo_url) mapping[e.slug] = e.logo_url;
    }
    return mapping;
  }

  async function postRender(format: Format, themeId: string | null): Promise<string> {
    const baseName = zipName?.replace(/\.zip$/i, "") ?? "carousel";
    const res = await fetch("/api/render-carousel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slides,
        mapping: computeMapping(),
        filename: baseName,
        format,
        themeId,
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
    return data.render_id as string;
  }

  // Initial render kicked off from the editor.
  async function submitRender(
    mapping: Record<string, string>,
    format: Format,
    themeId: string | null,
  ) {
    setRenderError(null);
    setActiveThemeId(themeId);
    const renderId = await postRender(format, themeId);
    setPollingId(renderId);
    setPollingFormat(format);
    setStage("rendering");
    // mapping arg is ignored — we always recompute from entities so
    // the alternate-render path uses the latest resolved state.
    void mapping;
  }

  // Triggered from the result panel: render the same slides + mapping
  // again at the alternate format. Doesn't unmount the existing result
  // — the poller renders inline below the primary so the current
  // tracking form / preview stays put.
  async function alsoRender(format: Format) {
    setRenderError(null);
    try {
      const renderId = await postRender(format, activeThemeId);
      setPollingId(renderId);
      setPollingFormat(format);
    } catch (err) {
      setRenderError((err as Error).message);
    }
  }

  function landRender(record: RenderRecord) {
    if (!primary) {
      setPrimary(record);
    } else {
      setAlternate(record);
    }
    setPollingId(null);
    setPollingFormat(null);
    setStage("render");
  }

  // ----- render stage: primary exists (alternate may also exist or be polling)

  if (stage === "render" && primary) {
    const otherFormat: Format = primary.format === "pdf" ? "png-zip" : "pdf";
    return (
      <div className="space-y-4">
        <RenderResult
          renderId={primary.id}
          url={primary.url}
          kind={resultKind(primary.format)}
          onReset={reset}
        />

        {renderError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            {renderError}
          </p>
        )}

        {pollingId && pollingFormat && pollingFormat !== primary.format ? (
          <RenderPoller
            renderId={pollingId}
            message={`Also rendering as ${FORMAT_LABEL[pollingFormat]} — same slides, different format. About 2-3s per slide.`}
            onComplete={(url) =>
              landRender({ id: pollingId, url, format: pollingFormat })
            }
            onFailed={(message) => {
              setRenderError(message);
              setPollingId(null);
              setPollingFormat(null);
            }}
            onCancel={() => {
              setPollingId(null);
              setPollingFormat(null);
            }}
          />
        ) : alternate ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Also rendered as {FORMAT_LABEL[alternate.format]}
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              {FORMAT_HINT[alternate.format]}.
            </p>
            <a
              href={alternate.url}
              download
              className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary"
            >
              Download {FORMAT_LABEL[alternate.format]}
            </a>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="mb-2 text-xs text-muted-foreground">
              Cross-posting? Generate a {FORMAT_LABEL[otherFormat]} of the same
              slides {FORMAT_HINT[otherFormat]}.
            </p>
            <button
              type="button"
              onClick={() => void alsoRender(otherFormat)}
              className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary"
            >
              Also render as {FORMAT_LABEL[otherFormat]}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ----- rendering stage: no primary yet, full-screen poller

  if (stage === "rendering" && pollingId && pollingFormat) {
    return (
      <div className="space-y-3">
        <RenderPoller
          renderId={pollingId}
          message={`Rendering ${slides.length} slide${slides.length === 1 ? "" : "s"} as ${pollingFormat === "png-zip" ? "PNGs in a zip" : "a real-text PDF"} — about 2-3 seconds per slide.`}
          onComplete={(url) =>
            landRender({ id: pollingId, url, format: pollingFormat })
          }
          onFailed={(message) => {
            setRenderError(message);
            setPollingId(null);
            setPollingFormat(null);
            setStage("edit");
          }}
          onCancel={() => {
            // Stop polling and go back to the editor — the worker job
            // continues in the background.
            setPollingId(null);
            setPollingFormat(null);
            setStage("edit");
          }}
        />
      </div>
    );
  }

  // ----- edit stage

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
