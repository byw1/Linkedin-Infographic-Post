"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseCssTokens } from "@/lib/accent-rewrite";
import {
  buildAliasBridge,
  ensureFontImports,
  extractGoogleFontUrls,
} from "@/lib/theme-fonts";

interface Props {
  // Full theme CSS (the same string the API stores). Injected into a
  // sandboxed iframe so its `:root { --token }` declarations don't
  // leak into the rest of the settings page.
  css: string;
}

// Mini-slide that exercises every editable token role: canvas (page
// bg), panel + raised (KPI card stack), text (title + body + muted
// caption), accent (button, soft fill, accent text), signal badges
// (success/warn/error), border (hairline + strong), font (display
// vs base vs mono), radius. As the user changes any visual field,
// they see the impact here without uploading HTML.
//
// The preview is iframe-based — same pattern slide-preview.tsx uses
// for the editor — so the theme's `@import` of Google Fonts works
// natively without polluting the parent document's style sheets.
export function SampleSlide({ css }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => buildSampleHtml(), []);
  // Track whether the iframe has loaded its srcDoc. We can't trust
  // `contentDocument.readyState === "complete"` on first render —
  // a fresh iframe initially holds an about:blank document that's
  // already "complete", so injecting into it puts the style on the
  // wrong document (the real srcDoc loads moments later and wipes
  // it). Waiting on the load event guarantees we're targeting the
  // sample HTML's document.
  const [loaded, setLoaded] = useState(false);

  // Mark loaded on the iframe's first load event (when srcDoc has
  // actually rendered). Only runs once per iframe.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => setLoaded(true);
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, []);

  // Each css change re-injects the theme into the iframe head once
  // the srcDoc has loaded. We replace any prior viral-theme nodes
  // (style + link) and add fresh ones — keeps cascade order
  // predictable and lets the browser show <link> elements in
  // devtools so font-loading state is observable.
  useEffect(() => {
    if (!loaded) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const head = doc.head ?? doc.documentElement;
    if (!head) return;
    const TAG = "data-viral-theme";

    doc
      .querySelectorAll(`style[${TAG}], link[${TAG}]`)
      .forEach((el) => el.remove());

    // <link rel="stylesheet"> per Google Fonts URL. More reliable
    // than dynamic @import for fonts added post-load.
    for (const url of extractGoogleFontUrls(css)) {
      const link = doc.createElement("link");
      link.setAttribute("rel", "stylesheet");
      link.setAttribute("href", url);
      link.setAttribute(TAG, "");
      head.appendChild(link);
    }

    const style = doc.createElement("style");
    style.setAttribute(TAG, "");
    head.appendChild(style);
    // Same three-pass injection the editor + worker use:
    //   1. ensureFontImports — load Google Fonts the theme forgot
    //      (redundant with the <link> above; covers @import-only
    //      paths like the puppeteer worker).
    //   2. user CSS.
    //   3. buildAliasBridge — mirror canonical/legacy token names.
    //   4. OVERRIDES — !important body/html pin.
    const tokens = parseCssTokens(css);
    style.textContent = [
      ensureFontImports(css),
      buildAliasBridge(tokens),
      OVERRIDES,
    ].join("\n");
  }, [css, loaded]);

  return (
    <iframe
      ref={iframeRef}
      title="theme preview"
      srcDoc={html}
      sandbox="allow-same-origin"
      className="block h-[440px] w-full border bg-chalk"
    />
  );
}

const OVERRIDES = `
html, body { margin: 0; padding: 0; }
html {
  background-color: var(--color-background-primary, var(--bg-canvas)) !important;
}
body {
  background-color: var(--color-background-primary, var(--bg-canvas)) !important;
  color: var(--color-text-primary, var(--fg-primary)) !important;
  font-family: var(--font-family-base, var(--font-sans)) !important;
}
`;

function buildSampleHtml(): string {
  // The HTML uses every token through `var()` so the live preview
  // updates the moment any visual field changes. Hard-coded sizes
  // (px) only — no opinionated layout the user has to fight against.
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body>
<div style="
  padding: 20px;
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background: var(--color-background-primary);
  min-height: 100vh;
">
  <div style="font-size: 11px; color: var(--color-text-tertiary); letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6px;">
    Sample slide
  </div>
  <h1 style="
    font-family: var(--font-family-display);
    font-size: 22px;
    font-weight: 600;
    margin: 0 0 4px;
    line-height: 1.2;
    color: var(--color-text-primary);
  ">
    Acme — Q3 recap
  </h1>
  <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0 0 14px; line-height: 1.4;">
    A snapshot of where the team landed this quarter — revenue, signups, retention.
  </p>

  <div style="display:flex; gap:8px; margin-bottom:14px;">
    <div style="
      flex: 1;
      background: var(--color-background-secondary);
      border: 1px solid var(--color-border-tertiary);
      border-radius: var(--border-radius-md);
      padding: 10px 12px;
    ">
      <div style="font-size: 10px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">
        Revenue
      </div>
      <div style="font-family: var(--font-family-mono); font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin-top: 2px;">
        $2.4M
      </div>
      <div style="font-size: 10px; color: var(--color-signal-success); margin-top: 2px;">+18% QoQ</div>
    </div>
    <div style="
      flex: 1;
      background: var(--color-accent-soft);
      border: 1px solid var(--color-border-tertiary);
      border-radius: var(--border-radius-md);
      padding: 10px 12px;
    ">
      <div style="font-size: 10px; color: var(--color-accent-text); text-transform: uppercase; letter-spacing: 0.05em;">
        Signups
      </div>
      <div style="font-family: var(--font-family-mono); font-size: 18px; font-weight: 600; color: var(--color-accent-text); margin-top: 2px;">
        12,438
      </div>
      <div style="font-size: 10px; color: var(--color-accent-text); margin-top: 2px;">on track</div>
    </div>
  </div>

  <div style="
    background: var(--color-background-tertiary);
    border-radius: var(--border-radius-lg);
    padding: 12px 14px;
    margin-bottom: 14px;
  ">
    <div style="font-size: 12px; color: var(--color-text-secondary); line-height: 1.5;">
      <span style="color: var(--color-text-primary); font-weight: 500;">Retention</span> held steady
      at 94%, with a small dip in mid-tier accounts after the pricing change.
    </div>
  </div>

  <div style="display:flex; gap:6px; align-items:center; margin-bottom:14px; flex-wrap: wrap;">
    <span style="
      display:inline-flex; align-items:center; padding: 3px 8px;
      font-size: 10px; font-weight: 500; border-radius: 999px;
      background: var(--color-signal-success); color: var(--color-text-on-accent);
    ">success</span>
    <span style="
      display:inline-flex; align-items:center; padding: 3px 8px;
      font-size: 10px; font-weight: 500; border-radius: 999px;
      background: var(--color-signal-warn); color: var(--color-text-on-accent);
    ">warn</span>
    <span style="
      display:inline-flex; align-items:center; padding: 3px 8px;
      font-size: 10px; font-weight: 500; border-radius: 999px;
      background: var(--color-signal-error); color: var(--color-text-on-accent);
    ">error</span>
    <span style="font-size: 10px; color: var(--color-text-tertiary); margin-left: 4px;">
      signal badges
    </span>
  </div>

  <div style="display:flex; gap: 8px; align-items:center;">
    <button style="
      background: var(--color-accent-primary);
      color: var(--color-text-on-accent);
      border: 0;
      padding: 8px 14px;
      font-size: 12px; font-weight: 500;
      border-radius: var(--border-radius-sm);
      font-family: var(--font-family-base);
      cursor: pointer;
    ">Read the full report</button>
    <button style="
      background: transparent;
      color: var(--color-accent-primary);
      border: 1px solid var(--color-border-primary);
      padding: 8px 14px;
      font-size: 12px; font-weight: 500;
      border-radius: var(--border-radius-sm);
      font-family: var(--font-family-base);
      cursor: pointer;
    ">Share</button>
  </div>

  <div style="
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px solid var(--color-border-tertiary);
    font-size: 10px;
    color: var(--color-text-tertiary);
  ">
    credit: @bywilliaml — sample slide for theme preview
  </div>
</div>
</body></html>`;
}
