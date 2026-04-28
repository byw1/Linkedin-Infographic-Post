import puppeteer, { type Browser } from "puppeteer-core";

export async function htmlToPng(html: string, width = 720): Promise<Buffer> {
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

    // If the user uploaded a complete document, hand it to Chromium as-is
    // — wrapping it in a fresh <body> nests the user's <html>/<body> and
    // strips their body-level styles (notably `background`), which made
    // the rendered PNG light-mode even when the iframe preview was dark.
    // For bare fragments, add minimal scaffolding so charset and a sensible
    // default font are available.
    const isFullDoc = /<\s*(?:!doctype\s+html|html\b|body\b)/i.test(html);
    const content = isFullDoc
      ? html
      : `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
</head>
<body>${html}</body>
</html>`;

    // networkidle2 (≤ 2 lingering connections for 500ms) instead of 0,
    // since some chart CDNs leave keep-alive sockets open.
    stage = "setContent";
    await page.setContent(content, { waitUntil: "networkidle2", timeout: 30_000 });

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
