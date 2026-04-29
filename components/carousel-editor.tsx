"use client";

import { useState, useTransition } from "react";
import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import type { ResolvedEntity } from "@/types/entity";
import { EditorPanel } from "@/components/editor-panel";
import { SlidePreview } from "@/components/slide-preview";
import type { CarouselSlide } from "@/components/carousel-upload-dropzone";

const SLIDE_WIDTH = 1080;
// Width the in-page preview is scaled to. The iframe still lays out at
// SLIDE_WIDTH internally; this only controls the visible footprint.
const PREVIEW_DISPLAY_WIDTH = 720;

interface Props {
  slides: CarouselSlide[];
  entities: ResolvedEntity[];
  onEntitiesChange: (next: ResolvedEntity[]) => void;
  onBack: () => void;
  onRendered: (pdf: Blob, totalEntities: number) => Promise<void>;
  storageReady: boolean;
}

export function CarouselEditor({
  slides,
  entities,
  onEntitiesChange,
  onBack,
  onRendered,
  storageReady,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, startRender] = useTransition();

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
      setError("Storage isn't configured. PDF export is disabled.");
      return;
    }
    const mapping: Record<string, string> = {};
    for (const e of entities) {
      if (e.logo_url) mapping[e.slug] = e.logo_url;
    }
    startRender(async () => {
      try {
        setProgress({ current: 0, total: slides.length });
        const pdf = await renderSlidesToPdf(slides, mapping, (current, totalCount) =>
          setProgress({ current, total: totalCount }),
        );
        await onRendered(pdf, entities.length);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setProgress(null);
      }
    });
  }

  function jumpToSlugSlide(slug: string) {
    // Find the first slide whose HTML mentions this data-entity slug and
    // jump there before opening the editor panel — saves a manual hunt.
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
        <button
          type="button"
          onClick={startRenderClick}
          disabled={!allResolved || rendering || !storageReady}
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {rendering ? "Rendering..." : "Render PDF"}
        </button>
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
        // Auto-fit each slide's height to its content. Forcing 1080 tall
        // would render any unused vertical space as the body's bg color,
        // so a slide whose layout is shorter than 1080 came out with a
        // dark band above and/or below the content.
        renderHeight="auto"
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

      {progress && (
        <div className="rounded-md border p-4 text-sm">
          Rendering slide {progress.current} of {progress.total}…
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${(progress.current / Math.max(progress.total, 1)) * 100}%`,
              }}
            />
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

// Renders each slide in an off-screen iframe at 1080 wide, snapshots
// with html-to-image, and stitches into a multi-page PDF. Each PDF
// page is sized to the slide's actual content height (1080 wide × N
// tall) — slides shorter than 1080 don't get a dark band of body bg
// padded onto them, and slides taller than 1080 don't get clipped.
async function renderSlidesToPdf(
  slides: CarouselSlide[],
  mapping: Record<string, string>,
  onProgress: (current: number, total: number) => void,
): Promise<Blob> {
  let pdf: jsPDF | null = null;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    onProgress(i, slides.length);
    const { dataUrl, height } = await renderSlideToPng(slide, mapping);
    if (!pdf) {
      pdf = new jsPDF({
        unit: "px",
        format: [SLIDE_WIDTH, height],
        orientation: "portrait",
        compress: true,
        hotfixes: ["px_scaling"],
      });
    } else {
      pdf.addPage([SLIDE_WIDTH, height], "portrait");
    }
    pdf.addImage(dataUrl, "PNG", 0, 0, SLIDE_WIDTH, height);
    onProgress(i + 1, slides.length);
  }

  if (!pdf) throw new Error("No slides to render.");
  return pdf.output("blob");
}

async function renderSlideToPng(
  slide: CarouselSlide,
  mapping: Record<string, string>,
): Promise<{ dataUrl: string; height: number }> {
  // Off-screen iframe that doesn't paint into the page but is still a
  // real document (so layout, fonts, and html-to-image's serialization
  // all behave the same as the visible preview).
  const iframe = document.createElement("iframe");
  // Start tall enough to give vh-relative content room to lay out;
  // we read the actual scrollHeight after layout settles.
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:" +
    SLIDE_WIDTH +
    "px;height:" +
    SLIDE_WIDTH +
    "px;border:0;background:#fff";
  iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve) => {
      const onLoad = () => resolve();
      iframe.addEventListener("load", onLoad, { once: true });
      iframe.srcdoc = slide.html;
    });

    const doc = iframe.contentDocument;
    if (!doc?.documentElement || !doc.body) {
      throw new Error(`Slide ${slide.filename}: iframe failed to initialize.`);
    }

    applyMapping(doc, mapping);
    await waitForImages(doc);
    // Charting libraries (Chart.js, etc.) draw to <canvas> after their
    // scripts run and animate over ~1s. The visible editor preview hides
    // this because the user takes seconds to scrub between slides; the
    // off-screen render is fast enough that, without a settle wait,
    // we'd snapshot a half-drawn (or empty) canvas. Wait long enough
    // for the default Chart.js animation, but only when a canvas is
    // actually present so non-chart slides don't pay the cost.
    if (doc.querySelectorAll("canvas").length > 0) {
      await new Promise((r) => setTimeout(r, 1500));
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const root = doc.documentElement;
    const win = iframe.contentWindow;
    const isOpaque = (c: string) =>
      !!c && c !== "transparent" && !/^rgba?\([^)]*,\s*0\s*\)$/i.test(c);
    const bodyBg = win ? win.getComputedStyle(doc.body).backgroundColor : "";
    const htmlBg = win ? win.getComputedStyle(root).backgroundColor : "";
    const canvasBg = isOpaque(bodyBg)
      ? bodyBg
      : isOpaque(htmlBg)
        ? htmlBg
        : "#ffffff";

    // Capture the slide's actual content height. Forcing a 1080 floor
    // would re-introduce the bg-color band below short slides — exactly
    // the bug we're fixing. The Math.max guards against the rare case
    // where one of scrollHeights resolves to 0 (e.g. a body that's
    // display:none for a frame during chart hydration).
    const height = Math.max(root.scrollHeight, doc.body.scrollHeight, 1);

    const dataUrl = await htmlToImage.toPng(root, {
      pixelRatio: 2,
      cacheBust: true,
      width: SLIDE_WIDTH,
      height,
      backgroundColor: canvasBg,
    });
    return { dataUrl, height };
  } finally {
    iframe.remove();
  }
}

function applyMapping(doc: Document, mapping: Record<string, string>) {
  const all = Array.from(doc.querySelectorAll<HTMLElement>("[data-entity]"));
  for (const el of all) {
    const slug = el.getAttribute("data-entity");
    if (!slug) continue;
    const url = mapping[slug];
    if (!url) continue;
    if (el.tagName === "IMG") {
      (el as HTMLImageElement).src = url;
      continue;
    }
    const img = doc.createElement("img");
    img.setAttribute("src", url);
    img.setAttribute("alt", slug);
    img.setAttribute("data-entity", slug);
    if (el.className) img.className = el.className;
    if (el.id) img.id = el.id;
    img.setAttribute("style", buildImgStyle(el.getAttribute("style") ?? ""));
    el.replaceWith(img);
  }
}

function buildImgStyle(inline: string): string {
  const w = parseStyleValue(inline, "width");
  const h = parseStyleValue(inline, "height");
  const r = parseStyleValue(inline, "border-radius");
  const mb = parseStyleValue(inline, "margin-bottom");
  const fs = parseStyleValue(inline, "flex-shrink");
  return [
    w && `width:${w}`,
    h && `height:${h}`,
    r && `border-radius:${r}`,
    mb && `margin-bottom:${mb}`,
    fs && `flex-shrink:${fs}`,
    "object-fit:cover",
    "background:#fff",
    "display:block",
  ]
    .filter(Boolean)
    .join(";");
}

function parseStyleValue(style: string, prop: string): string | null {
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
  return m ? m[1].trim() : null;
}

async function waitForImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.images);
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 5000);
          }),
    ),
  );
}
