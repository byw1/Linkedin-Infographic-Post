import puppeteer, { type Browser } from "puppeteer-core";

export interface Mapping {
  [slug: string]: string;
}

export async function htmlToPng(
  html: string,
  mapping: Mapping,
  width = 720,
): Promise<Buffer> {
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

    stage = "newPage";
    const page = await browser.newPage();
    await page.setViewport({ width, height: 100, deviceScaleFactor: 2 });
    // Match the editor's iframe, which inherits the user's OS / browser
    // dark-mode preference. Headless Chromium defaults to light, so any
    // CSS the user gates on `@media (prefers-color-scheme: dark)` (very
    // common for "auto" infographic templates) silently doesn't apply
    // and the PNG comes out white.
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "dark" },
    ]);

    // Hand the HTML to Chromium as-is and do the placeholder→<img> swap
    // in-page, the same way the editor's iframe does. The earlier path
    // round-tripped through cheerio (which re-serializes the document and
    // can move <style> blocks between head/body) and then layered our own
    // <body> wrapper on top, both of which silently dropped user body-level
    // styling — so the rendered PNG ended up on a white body even when the
    // preview was dark. setContent + in-page swap keeps the worker's render
    // environment identical to the iframe's.

    // networkidle2 (≤ 2 lingering connections for 500ms) instead of 0,
    // since some chart CDNs leave keep-alive sockets open.
    stage = "setContent";
    await page.setContent(html, { waitUntil: "networkidle2", timeout: 30_000 });

    stage = "applyMapping";
    await page.evaluate((m: Mapping) => {
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

    stage = "waitForImages";
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(() => resolve(), 5000);
              }),
        ),
      );
    });

    // Charting libraries (Chart.js, etc.) draw to <canvas> after their
    // scripts run; networkidle fires before the animation finishes.
    stage = "waitForCanvas";
    if ((await page.$$("canvas")).length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    stage = "resizeViewport";
    const bodyHandle = await page.$("body");
    const box = bodyHandle ? await bodyHandle.boundingBox() : null;
    if (box) {
      await page.setViewport({
        width,
        height: Math.ceil(box.height),
        deviceScaleFactor: 2,
      });
    }

    stage = "screenshot";
    const png = await page.screenshot({
      type: "png",
      omitBackground: false,
      fullPage: true,
    });

    return Buffer.from(png);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const e = new Error(`htmlToPng failed at stage="${stage}": ${message}`);
    if (err instanceof Error && err.stack) (e as Error & { cause?: unknown }).cause = err;
    throw e;
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
