import puppeteer, { type Browser } from "puppeteer-core";

export async function htmlToPng(html: string, width = 720): Promise<Buffer> {
  const browser: Browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 100, deviceScaleFactor: 2 });

    const wrapped = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
</head>
<body>${html}</body>
</html>`;

    await page.setContent(wrapped, { waitUntil: "networkidle0", timeout: 30_000 });

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

    // Charting libraries (Chart.js, etc.) render to <canvas> after their
    // scripts run; networkidle0 fires before the animation finishes. Wait
    // briefly so canvases are drawn before screenshot.
    if ((await page.$$("canvas")).length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const bodyHandle = await page.$("body");
    const box = bodyHandle ? await bodyHandle.boundingBox() : null;
    if (box) {
      await page.setViewport({
        width,
        height: Math.ceil(box.height),
        deviceScaleFactor: 2,
      });
    }

    const png = await page.screenshot({
      type: "png",
      omitBackground: false,
      fullPage: true,
    });

    return Buffer.from(png);
  } finally {
    await browser.close();
  }
}
