import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { PDFDocument } from "pdf-lib";

export interface SlideInput {
  filename: string;
  html: string;
}

export interface ExportOptions {
  width?: number;
  height?: number;
  // Per-slide log hook so the worker can stream progress into BullMQ.
  onSlide?: (current: number, total: number) => void | Promise<void>;
}

const DEFAULT_SIZE = 1080;

// Renders a list of slide HTMLs into a single multi-page PDF. Each
// page comes from puppeteer's `page.pdf()` (real text PDFs — text is
// selectable, fonts are embedded, file size is small) rather than a
// rasterized screenshot. The slide HTMLs are passed to setContent
// untouched; the data-entity → <img> swap is done in-page so the
// rendered output matches what the editor's iframe shows.
export async function htmlSlidesToPdf(
  slides: SlideInput[],
  mapping: Record<string, string>,
  options: ExportOptions = {},
): Promise<Buffer> {
  const width = options.width ?? DEFAULT_SIZE;
  const height = options.height ?? DEFAULT_SIZE;

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

    const slidePdfs: Buffer[] = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      stage = `slide ${i + 1} (${slide.filename})`;
      await options.onSlide?.(i, slides.length);
      const pdf = await renderSlide(browser, slide, mapping, width, height);
      slidePdfs.push(pdf);
    }
    await options.onSlide?.(slides.length, slides.length);

    stage = "merge";
    return mergePdfs(slidePdfs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(`htmlSlidesToPdf failed at stage="${stage}": ${message}`);
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

async function renderSlide(
  browser: Browser,
  slide: SlideInput,
  mapping: Record<string, string>,
  width: number,
  height: number,
): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    // Match the editor's preview, which inherits the user's OS dark
    // preference — most templates have @media
    // (prefers-color-scheme: dark) rules and rendered light otherwise.
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "dark" },
    ]);

    // Hand the slide HTML to Chromium as-is; the editor uses srcDoc
    // the same way and cheerio re-serialization or wrapper bodies were
    // dropping body-level styling.
    await page.setContent(slide.html, {
      waitUntil: "networkidle2",
      timeout: 30_000,
    });

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
    // settle. Without these, page.pdf() snapshots a partial frame.
    await waitForImagesAndCanvas(page);

    // Wait for any web fonts to load — Chromium will otherwise embed
    // the fallback into the PDF and your nice Inter stack disappears.
    await page.evaluate(() => document.fonts?.ready);

    const pdf = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      preferCSSPageSize: false,
      // Zero margins so the slide bleeds to the page edges — the
      // template controls its own padding.
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
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
