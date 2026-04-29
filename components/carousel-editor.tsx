"use client";

import { useState, useTransition } from "react";
import type { ResolvedEntity } from "@/types/entity";
import { EditorPanel } from "@/components/editor-panel";
import { SlidePreview } from "@/components/slide-preview";
import type { CarouselSlide } from "@/components/carousel-upload-dropzone";

const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1350;
// Width the in-page preview is scaled to. The iframe still lays out at
// the full slide size internally; this only controls the visible
// footprint.
const PREVIEW_DISPLAY_WIDTH = 720;

type Format = "pdf" | "png-zip";

interface Props {
  slides: CarouselSlide[];
  entities: ResolvedEntity[];
  onEntitiesChange: (next: ResolvedEntity[]) => void;
  onBack: () => void;
  // Mapping + format handed off to the server-side renderer. The flow
  // above POSTs slides + mapping + format to /api/render-carousel and
  // polls status.
  onSubmit: (mapping: Record<string, string>, format: Format) => Promise<void>;
  storageReady: boolean;
}

export function CarouselEditor({
  slides,
  entities,
  onEntitiesChange,
  onBack,
  onSubmit,
  storageReady,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [format, setFormat] = useState<Format>("pdf");

  const total = entities.length;
  const resolvedCount = entities.filter((e) => e.resolved).length;
  const allResolved = total > 0 && resolvedCount === total;
  const activeEntity = activeSlug ? entities.find((e) => e.slug === activeSlug) : null;
  const currentSlide = slides[activeIndex];
  const unresolved = entities.filter((e) => !e.resolved);

  function update(slug: string, patch: Partial<ResolvedEntity>) {
    const next = entities.map((e) => (e.slug === slug ? { ...e, ...patch } : e));
    onEntitiesChange(next);
  }

  function startRenderClick() {
    setError(null);
    if (!allResolved) return;
    if (!storageReady) {
      setError("Storage isn't configured. Export is disabled.");
      return;
    }
    const mapping: Record<string, string> = {};
    for (const e of entities) {
      if (e.logo_url) mapping[e.slug] = e.logo_url;
    }
    startSubmit(async () => {
      try {
        await onSubmit(mapping, format);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function jumpToSlugSlide(slug: string) {
    // Find the first slide whose HTML mentions this data-entity slug
    // and jump there before opening the editor panel — saves a manual
    // hunt across slides.
    const idx = slides.findIndex((s) =>
      s.html.includes(`data-entity="${slug}"`),
    );
    if (idx >= 0) setActiveIndex(idx);
    setActiveSlug(slug);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Use a different zip
          </button>
          <span className="text-sm text-muted-foreground">
            {resolvedCount} of {total} resolved
            {!allResolved && (
              <>
                {" "}
                · <span className="text-amber-600">click any dashed box</span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            <FormatTab active={format === "pdf"} onClick={() => setFormat("pdf")}>
              PDF
            </FormatTab>
            <FormatTab active={format === "png-zip"} onClick={() => setFormat("png-zip")}>
              PNG zip
            </FormatTab>
          </div>
          <button
            type="button"
            onClick={startRenderClick}
            disabled={!allResolved || submitting || !storageReady}
            className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            title={
              format === "png-zip"
                ? "One PNG per slide, zipped — for Instagram or anywhere that doesn't take PDFs."
                : "Real-text PDF, one page per slide — for LinkedIn document carousels."
            }
          >
            {submitting
              ? "Queueing..."
              : format === "png-zip"
                ? "Render PNG zip"
                : "Render PDF"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <SlidePreview
        // Re-mount when the slide changes so DOM-swap state from the
        // previous slide can't leak across iframe documents.
        key={activeIndex}
        html={currentSlide.html}
        entities={entities}
        onSlugClick={setActiveSlug}
        renderWidth={SLIDE_WIDTH}
        renderHeight={SLIDE_HEIGHT}
        displayMaxWidth={PREVIEW_DISPLAY_WIDTH}
      />

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          disabled={activeIndex === 0}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-base hover:bg-secondary disabled:opacity-40"
          aria-label="Previous slide"
        >
          ←
        </button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {activeIndex + 1} / {slides.length}
          <span className="ml-2 hidden text-xs sm:inline">{currentSlide.filename}</span>
        </span>
        <button
          type="button"
          onClick={() => setActiveIndex((i) => Math.min(slides.length - 1, i + 1))}
          disabled={activeIndex === slides.length - 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-base hover:bg-secondary disabled:opacity-40"
          aria-label="Next slide"
        >
          →
        </button>
      </div>

      {!allResolved && unresolved.length > 0 && (
        <div className="rounded-md border bg-amber-500/5 p-3 text-sm">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-300">
            Unresolved across the carousel
          </div>
          <div className="flex flex-wrap gap-2">
            {unresolved.map((e) => (
              <button
                key={e.slug}
                type="button"
                onClick={() => jumpToSlugSlide(e.slug)}
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/20"
              >
                <span className="font-mono">{e.slug}</span>
                <span className="text-amber-400/70">×{e.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeEntity && (
        <EditorPanel
          entity={activeEntity}
          onClose={() => setActiveSlug(null)}
          onResolved={(logoUrl, displayName) => {
            update(activeEntity.slug, {
              resolved: true,
              logo_url: logoUrl,
              display_name: displayName,
            });
            setActiveSlug(null);
          }}
          onUnresolve={() => {
            update(activeEntity.slug, {
              resolved: false,
              logo_url: undefined,
              display_name: undefined,
            });
            setActiveSlug(null);
          }}
        />
      )}
    </div>
  );
}

function FormatTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm px-2 py-1 font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
