"use client";

import { useState, useTransition } from "react";
import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import type { ResolvedEntity } from "@/types/entity";
import { EntityResolver } from "@/components/entity-resolver";
import type { CarouselSlide } from "@/components/carousel-upload-dropzone";

interface Props {
  slides: CarouselSlide[];
  entities: ResolvedEntity[];
  onEntitiesChange: (next: ResolvedEntity[]) => void;
  onBack: () => void;
  onRendered: (pdf: Blob, totalEntities: number) => Promise<void>;
  storageReady: boolean;
}

const SLIDE_SIZE = 1080;

export function CarouselEditor({
  slides,
  entities,
  onEntitiesChange,
  onBack,
  onRendered,
  storageReady,
}: Props) {
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTask] = useTransition();

  async function handleRender(mapping: Record<string, string>) {
    setError(null);
    setProgress({ current: 0, total: slides.length });
    try {
      const pdf = await renderSlidesToPdf(slides, mapping, (current, total) =>
        setProgress({ current, total }),
      );
      await onRendered(pdf, entities.length);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-4 text-sm">
        <div className="font-medium text-card-foreground">
          {slides.length} slide{slides.length === 1 ? "" : "s"} loaded
        </div>
        <ol className="mt-2 list-decimal pl-5 text-xs text-muted-foreground">
          {slides.map((s) => (
            <li key={s.filename}>{s.filename}</li>
          ))}
        </ol>
      </div>

      <EntityResolver
        initialEntities={entities}
        onEntitiesChange={onEntitiesChange}
        onBack={onBack}
        onRender={(mapping) =>
          new Promise((resolve, reject) => {
            startTask(() => {
              handleRender(mapping).then(resolve, reject);
            });
          })
        }
        storageReady={storageReady}
        backLabel="← Use a different zip"
        renderLabel="Render PDF"
        renderingLabel="Rendering..."
      />

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

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// Renders each slide in an off-screen iframe at 1080×1080, swaps
// data-entity placeholders against the supplied mapping, snapshots
// with html-to-image, and stitches into a multi-page PDF (one page
// per slide, page sized 1080×1080 in pixel units).
async function renderSlidesToPdf(
  slides: CarouselSlide[],
  mapping: Record<string, string>,
  onProgress: (current: number, total: number) => void,
): Promise<Blob> {
  const pdf = new jsPDF({
    unit: "px",
    format: [SLIDE_SIZE, SLIDE_SIZE],
    orientation: "portrait",
    compress: true,
    hotfixes: ["px_scaling"],
  });

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    onProgress(i, slides.length);
    const dataUrl = await renderSlideToPng(slide, mapping);
    if (i > 0) pdf.addPage([SLIDE_SIZE, SLIDE_SIZE], "portrait");
    pdf.addImage(dataUrl, "PNG", 0, 0, SLIDE_SIZE, SLIDE_SIZE);
    onProgress(i + 1, slides.length);
  }

  return pdf.output("blob");
}

async function renderSlideToPng(
  slide: CarouselSlide,
  mapping: Record<string, string>,
): Promise<string> {
  // Off-screen iframe that doesn't paint into the page but is still a
  // real document (so layout, fonts, and html-to-image's serialization
  // all behave the same as the editor's preview).
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:" +
    SLIDE_SIZE +
    "px;height:" +
    SLIDE_SIZE +
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
    // One frame for layout to settle after the swap.
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

    const dataUrl = await htmlToImage.toPng(root, {
      pixelRatio: 2,
      cacheBust: true,
      width: SLIDE_SIZE,
      height: SLIDE_SIZE,
      backgroundColor: canvasBg,
    });
    return dataUrl;
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
