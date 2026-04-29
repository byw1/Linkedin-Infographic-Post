import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { parseCssTokens, rewriteAccents } from "@/lib/accent-rewrite";
import { CHART_RETHEME_SCRIPT } from "@/lib/theme-charts";

export type OutputFormat = "pdf" | "png-zip";

export interface SlideInput {
  filename: string;
  html: string;
}

export interface ExportOptions {
  width?: number;
  height?: number;
  // Optional brand theme CSS — same string the editor iframe injects,
  // appended to the page after layout-clamp styles so its `:root`
  // tokens win the cascade.
  themeCss?: string;
  // Per-slide log hook so the worker can stream progress into BullMQ.
  onSlide?: (current: number, total: number) => void | Promise<void>;
}

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  extension: "pdf" | "zip";
}

// 4:5 portrait — Instagram's recommended carousel size and LinkedIn
// document carousels render fine at the same crop, so one size covers
// both surfaces.
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1350;

// Renders a list of slide HTMLs into either a single multi-page PDF
// (real text PDFs — text is selectable, fonts embed, file is small)
// or a zip of one PNG per slide (for Instagram or anywhere that
// doesn't accept document carousels). The slide HTMLs are passed to
// setContent untouched; the data-entity → <img> swap is done in-page
// so the rendered output matches the editor's iframe exactly.
export async function htmlSlidesToOutput(
  slides: SlideInput[],
  mapping: Record<string, string>,
  format: OutputFormat,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;

  if (slides.length === 0) {
    throw new Error("No slides provided.");
  }

  let stage = "launch";
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=none",
      ],
    });

    const slideBuffers: Buffer[] = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      stage = `slide ${i + 1} (${slide.filename})`;
      await options.onSlide?.(i, slides.length);
      const buf = await captureSlide(
        browser,
        slide,
        mapping,
        format,
        width,
        height,
        options.themeCss,
      );
      slideBuffers.push(buf);
    }
    await options.onSlide?.(slides.length, slides.length);

    if (format === "pdf") {
      stage = "merge-pdf";
      return {
        buffer: await mergePdfs(slideBuffers),
        contentType: "application/pdf",
        extension: "pdf",
      };
    } else {
      stage = "zip-pngs";
      return {
        buffer: await zipPngs(slideBuffers, slides),
        contentType: "application/zip",
        extension: "zip",
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(
      `htmlSlidesToOutput[${format}] failed at stage="${stage}": ${message}`,
    );
    if (err instanceof Error && err.stack) {
      (wrapped as Error & { cause?: unknown }).cause = err;
    }
    throw wrapped;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // already dead
      }
    }
  }
}

async function captureSlide(
  browser: Browser,
  slide: SlideInput,
  mapping: Record<string, string>,
  format: OutputFormat,
  width: number,
  height: number,
  themeCss?: string,
): Promise<Buffer> {
  // PNGs go to Instagram / posted as raster; 2× DPR keeps text sharp
  // on retina. PDFs are vector text so the scale doesn't matter for
  // text quality; keeping it at 1 saves memory and time.
  const deviceScaleFactor = format === "png-zip" ? 2 : 1;

  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor });
    // Match the editor's preview, which inherits the user's OS dark
    // preference — most templates have @media
    // (prefers-color-scheme: dark) rules and rendered light otherwise.
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "dark" },
    ]);
    // Render with screen media so charts and CSS that the user designed
    // for the iframe behave the same. page.pdf() defaults to print
    // media, which strips backgrounds and changes layout — both wrong
    // for an infographic.
    await page.emulateMediaType("screen");

    // Rewrite hard-coded hex values inside inline `style="…"`
    // attributes to `var(--color-…)` references mapped against the
    // active theme + the well-known Claude default palette. This is
    // what makes a theme switch actually transform the rendered
    // output — without this pass, KPI cards and timeline pills keep
    // whatever hex Claude generated them with regardless of theme.
    const sourceHtml = themeCss
      ? rewriteAccents(slide.html, parseCssTokens(themeCss))
      : rewriteAccents(slide.html, {});

    // Hand the slide HTML to Chromium; the editor uses srcDoc
    // the same way and cheerio re-serialization or wrapper bodies were
    // dropping body-level styling.
    await page.setContent(sourceHtml, {
      waitUntil: "networkidle2",
      timeout: 30_000,
    });

    // Pin the document to exactly width × height so each slide is one
    // page / one screenshot. Without this, the default 8px body margin
    // alone is enough to push content past the edge — for PDF that
    // means a phantom second page, for PNG that means content getting
    // cropped or the screenshot dimensions being off. overflow:hidden
    // clips any rogue overflow rather than letting it spill.
    await page.addStyleTag({
      content: `
        @page { size: ${width}px ${height}px; margin: 0 }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
        }
        body {
          width: ${width}px !important;
          height: ${height}px !important;
          overflow: hidden !important;
        }
      `,
    });

    // Theme injection. Added after the layout-clamp styles so its
    // `:root` tokens win the cascade against any `:root` declarations
    // the source HTML defined earlier in its own head.
    if (themeCss) {
      await page.addStyleTag({ content: themeCss });
      // Chart.js dataset colors live in `<script>` blocks the inline-
      // style accent rewrite can't safely touch. This script polls
      // Chart.instances and substitutes well-known accent hex on the
      // datasets in place. waitForImagesAndCanvas below already
      // sleeps long enough that the substitution lands before
      // capture.
      await page.addScriptTag({ content: CHART_RETHEME_SCRIPT });
    }

    // Same data-entity → <img> swap the editor does in-page, so we
    // share the exact same DOM mutation logic on both sides.
    await page.evaluate((m: Record<string, string>) => {
      function parseStyleValue(style: string, prop: string): string | null {
        const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i");
        const match = style.match(re);
        return match ? match[1].trim() : null;
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

      const all = Array.from(document.querySelectorAll<HTMLElement>("[data-entity]"));
      for (const el of all) {
        const slug = el.getAttribute("data-entity");
        if (!slug) continue;
        const url = m[slug];
        if (!url) continue;
        if (el.tagName === "IMG") {
          (el as HTMLImageElement).src = url;
          continue;
        }
        const img = document.createElement("img");
        img.setAttribute("src", url);
        img.setAttribute("alt", slug);
        img.setAttribute("data-entity", slug);
        if (el.className) img.className = el.className;
        if (el.id) img.id = el.id;
        const inline = el.getAttribute("style") ?? "";
        img.setAttribute("style", buildImgStyle(inline));
        el.replaceWith(img);
      }
    }, mapping);

    // Wait for replaced <img> tags to load AND for chart canvases to
    // settle. Without these, the capture lands on a partial frame.
    await waitForImagesAndCanvas(page);

    // Wait for any web fonts to load — Chromium will otherwise embed
    // the fallback (PDF) or rasterize the fallback (PNG) and your
    // nice Inter stack disappears.
    await page.evaluate(() => document.fonts?.ready);

    if (format === "pdf") {
      const pdf = await page.pdf({
        width: `${width}px`,
        height: `${height}px`,
        printBackground: true,
        // Honor the injected @page size + body clamp above. Without
        // this, Chromium falls back to width/height and ignores our
        // overflow rules.
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return Buffer.from(pdf);
    } else {
      // Explicit clip to the slide box, so the screenshot dims match
      // exactly what the iframe shows even if the user's HTML
      // overflows.
      const png = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width, height },
        omitBackground: false,
      });
      return Buffer.from(png);
    }
  } finally {
    try {
      await page.close();
    } catch {
      // already closed
    }
  }
}

async function waitForImagesAndCanvas(page: Page): Promise<void> {
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images).map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(() => resolve(), 5000);
            }),
      ),
    );
  });
  // Chart.js etc. animate over ~1s after their script runs; without
  // this the canvas captures empty.
  const hasCanvas = (await page.$$("canvas")).length > 0;
  if (hasCanvas) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function mergePdfs(slidePdfs: Buffer[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const buf of slidePdfs) {
    const src = await PDFDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  const bytes = await out.save();
  return Buffer.from(bytes);
}

async function zipPngs(pngBuffers: Buffer[], slides: SlideInput[]): Promise<Buffer> {
  const zip = new JSZip();
  // Numeric prefix preserves slide order even when the original slide
  // filenames sort weirdly. Width is dynamic so 10+ slides still pad
  // correctly (01.png, 02.png, ..., 10.png).
  const pad = String(pngBuffers.length).length;
  for (let i = 0; i < pngBuffers.length; i++) {
    const num = String(i + 1).padStart(pad, "0");
    const stem = slides[i].filename.replace(/\.html?$/i, "") || `slide-${num}`;
    zip.file(`${num}_${stem}.png`, pngBuffers[i]);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}
