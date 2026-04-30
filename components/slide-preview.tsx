"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as htmlToImage from "html-to-image";
import {
  applyAccentRewriteToDocument,
  parseCssTokens,
} from "@/lib/accent-rewrite";
import {
  buildAliasBridge,
  ensureFontImports,
  extractGoogleFontUrls,
} from "@/lib/theme-fonts";
import { CHART_RETHEME_SCRIPT } from "@/lib/theme-charts";
import type { ResolvedEntity } from "@/types/entity";

const OUTLINE_UNRESOLVED = "2px dashed #f59e0b";
const OUTLINE_RESOLVED = "0 solid transparent";
const OUTLINE_HOVER_UNRESOLVED = "2px solid #f59e0b";
const OUTLINE_HOVER_RESOLVED = "2px solid #6366f1";

export interface SlidePreviewHandle {
  capture(): Promise<Blob>;
}

// Snapshot of how the active theme is actually rendering in the
// iframe right now. Used by the picker's diagnostics panel so the
// user can see at a glance whether fonts loaded, hex got rewritten,
// charts were detected, etc. — without opening devtools.
export interface ThemeDiagnostics {
  // First family in body's computed font-family stack — the face the
  // browser will use when it's available. Quoted families take
  // priority; falls through to unquoted keywords (system-ui,
  // -apple-system, sans-serif). null when neither path matches.
  fontFamily: string | null;
  // Whether `document.fonts.check()` says the family is loaded. null
  // when there's no family to check.
  fontLoaded: boolean | null;
  // Full body computed font-family stack, verbatim. Lets the user
  // see whether their custom family is even in the stack — if body
  // resolves to e.g. `system-ui, -apple-system, sans-serif` with no
  // 'Manrope' anywhere, the override never landed and the cascade
  // is what to debug, not the font fetch.
  fontFamilyRaw: string;
  // Raw `--font-family-base` resolved from the iframe's `:root` via
  // getComputedStyle on `documentElement`. This is the value the
  // theme injection set after cascade. If body's font-family doesn't
  // match this, the body rule lost the cascade fight; if this
  // doesn't match what the theme stores, the injection never won
  // over the source HTML.
  rootFontFamilyVar: string;
  // Number of `<link rel="stylesheet" data-viral-theme>` elements in
  // the iframe head. 0 = our font-loading injection didn't fire.
  themeLinks: number;
  // body's computed background-color + color, in rgb()/rgba() form
  // (whatever getComputedStyle returns). Lets the user spot
  // "background is still the source HTML's white" type bugs.
  backgroundColor: string;
  color: string;
  // Number of elements with a `style="…"` attribute that contains a
  // `var(--…)` reference. Indicates the accent rewriter ran (high
  // count = good, 0 = no rewrites = source HTML had no inline hex
  // or the rewriter didn't fire).
  tokenizedElements: number;
  // Total elements with inline styles, for context — gives a feel
  // for "how much of this HTML is var()-referenced".
  inlineStyledElements: number;
  // <canvas> element count — the chart re-theme script targets these
  // post-load. 0 = no charts.
  canvases: number;
}

interface Props {
  html: string;
  entities: ResolvedEntity[];
  onSlugClick: (slug: string) => void;
  // Layout width for the iframe content. Single-post uses 720; carousel
  // slides are 1080×1080.
  renderWidth: number;
  // Fixed iframe height in px, or "auto" to track body.scrollHeight.
  renderHeight: number | "auto";
  // Optional cap for display (CSS scale). When set, the iframe is
  // visually scaled to fit this width while still rendering at
  // renderWidth internally — capture honors the full render dims.
  displayMaxWidth?: number;
  // Active theme CSS — injected into the iframe head as a <style>
  // block so HTML authored against `var(--accent)` etc. picks up the
  // tokens. Updates re-inject without rebuilding the iframe.
  themeCss?: string | null;
  // Fired once after each theme application settles (inject + accent
  // rewrite + chart retheme polling). The picker's diagnostics
  // tooltip reads from this. Debounced internally so multiple rapid
  // theme changes only fire once at the end.
  onThemeApplied?: (diagnostics: ThemeDiagnostics) => void;
}

export const SlidePreview = forwardRef<SlidePreviewHandle, Props>(
  function SlidePreview(
    {
      html,
      entities,
      onSlugClick,
      renderWidth,
      renderHeight,
      displayMaxWidth,
      themeCss,
      onThemeApplied,
    },
    ref,
  ) {
    const onThemeAppliedRef = useRef(onThemeApplied);
    onThemeAppliedRef.current = onThemeApplied;
    const diagnosticsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    // Per-element snapshot of the original placeholder HTML, used to
    // revert on unresolve. WeakMap so we can transfer the snapshot from
    // the placeholder div to its <img> replacement and back.
    const originalsRef = useRef<WeakMap<Element, string>>(new WeakMap());
    const onSlugClickRef = useRef(onSlugClick);
    const entitiesRef = useRef<ResolvedEntity[]>(entities);
    entitiesRef.current = entities;
    onSlugClickRef.current = onSlugClick;
    const observersRef = useRef<{ ro?: ResizeObserver; mo?: MutationObserver }>({});

    const [iframeReady, setIframeReady] = useState(false);
    const [autoHeight, setAutoHeight] = useState<number>(
      renderHeight === "auto" ? 600 : renderHeight,
    );

    // srcDoc is computed exactly once per html prop change. Entity edits
    // are applied imperatively below — keeps scroll position and stops
    // charts from re-animating on every swap.
    const srcDoc = useMemo(() => html, [html]);

    // Initial iframe setup: snapshot placeholders, attach handlers, apply
    // any already-resolved entities.
    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      function setup() {
        const doc = iframe!.contentDocument;
        if (!doc) return;

        // For fixed-size slides (carousel mode), force the body to
        // exactly the slide size with no margin / padding and clip
        // overflow. Mirrors the worker's exporter so the editor
        // preview matches the rendered PDF / PNG. Templates often
        // ship body { padding: 20px; min-height: 100vh; display: flex }
        // assuming they're a full document — without this clamp the
        // 20px padding pushes the slide past the iframe's bottom edge,
        // showing a clipped bottom in the preview that doesn't appear
        // in the export.
        if (typeof renderHeight === "number") {
          const styleEl = doc.createElement("style");
          styleEl.textContent = `
            html, body {
              margin: 0 !important;
              padding: 0 !important;
            }
            body {
              width: ${renderWidth}px !important;
              height: ${renderHeight}px !important;
              overflow: hidden !important;
            }
          `;
          (doc.head ?? doc.documentElement).appendChild(styleEl);
        }

        // Theme injection. We tag the style element so subsequent
        // theme switches can find + replace it without affecting any
        // styles the source HTML brought along.
        applyTheme(doc, themeCss ?? null);

        // Rewrite hard-coded hex colors (#534AB7, #EEEDFE, …) in
        // every inline `style="…"` attribute to `var(--color-…)`
        // references mapped against the active theme + Claude's
        // well-known default palette. After this, theme switches
        // flow through the var() resolution automatically — no
        // need to walk the DOM again on every theme change.
        applyAccentRewriteToDocument(doc, parseCssTokens(themeCss));

        originalsRef.current = new WeakMap();

        const all = Array.from(
          doc.querySelectorAll<HTMLElement>("[data-entity]"),
        ).filter((el) => {
          const slug = el.getAttribute("data-entity");
          return slug && !slug.startsWith("unknown");
        });

        for (const el of all) originalsRef.current.set(el, el.outerHTML);

        const resolvedBySlug = new Map<string, ResolvedEntity>();
        for (const e of entitiesRef.current) {
          if (e.resolved && e.logo_url) resolvedBySlug.set(e.slug, e);
        }

        for (const el of all) {
          const slug = el.getAttribute("data-entity")!;
          const entity = resolvedBySlug.get(slug);
          if (entity) replaceWithImg(el, entity);
          else attachInteractivity(el, slug);
        }

        if (renderHeight === "auto") {
          const measure = () => {
            if (!doc.body || !doc.documentElement) return;
            const body = doc.body;
            const root = doc.documentElement;
            const h = Math.max(body.scrollHeight, body.offsetHeight, root.scrollHeight);
            setAutoHeight((prev) => (prev === h ? prev : h));
          };
          measure();
          const ro = new ResizeObserver(measure);
          ro.observe(doc.body);
          ro.observe(doc.documentElement);
          const mo = new MutationObserver(measure);
          mo.observe(doc.body, { childList: true, subtree: true, attributes: true });
          observersRef.current = { ro, mo };
        }

        // Initial diagnostics capture, after theme + accent rewrite +
        // chart script have all run. Mirrors the post-theme-change
        // capture below so the tooltip is populated as soon as the
        // first render lands.
        scheduleDiagnostics();
        setIframeReady(true);
      }

      iframe.addEventListener("load", setup);
      if (iframe.contentDocument?.readyState === "complete") setup();

      return () => {
        iframe.removeEventListener("load", setup);
        observersRef.current.ro?.disconnect();
        observersRef.current.mo?.disconnect();
        observersRef.current = {};
        if (diagnosticsTimerRef.current) {
          clearTimeout(diagnosticsTimerRef.current);
          diagnosticsTimerRef.current = null;
        }
        setIframeReady(false);
      };
    }, [srcDoc, renderHeight]);

    // Re-apply the theme when it changes mid-session (picker swap).
    // No iframe rebuild — we just update the tagged <style> tag.
    useEffect(() => {
      if (!iframeReady) return;
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      applyTheme(doc, themeCss ?? null);
      scheduleDiagnostics();
    }, [themeCss, iframeReady]);

    // Schedule a diagnostics capture ~600ms after the latest theme
    // change. The chart-retheme script polls for up to 6s after
    // load, but in practice charts settle within a few hundred ms;
    // 600ms is enough to capture post-rewrite state without making
    // the picker tooltip feel stale. Debounced via the timer ref so
    // a flurry of theme changes only fires once.
    function scheduleDiagnostics() {
      if (diagnosticsTimerRef.current) {
        clearTimeout(diagnosticsTimerRef.current);
      }
      diagnosticsTimerRef.current = setTimeout(() => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return;
        const d = captureDiagnostics(doc);
        if (d) onThemeAppliedRef.current?.(d);
      }, 600);
    }

    // Subsequent edits — diff entities state against iframe DOM and
    // apply changes without rebuilding srcDoc.
    useEffect(() => {
      if (!iframeReady) return;
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;

      for (const e of entities) {
        const els = doc.querySelectorAll<HTMLElement>(
          `[data-entity="${cssEscape(e.slug)}"]`,
        );
        els.forEach((el) => {
          const isImg = el.tagName === "IMG";
          if (e.resolved && e.logo_url) {
            if (isImg) {
              if ((el as HTMLImageElement).src !== e.logo_url) {
                (el as HTMLImageElement).src = e.logo_url;
              }
            } else {
              replaceWithImg(el, e);
            }
          } else if (isImg) {
            revertToPlaceholder(el);
          }
        });
      }
    }, [entities, iframeReady]);

    useImperativeHandle(
      ref,
      () => ({
        async capture(): Promise<Blob> {
          const iframe = iframeRef.current;
          const doc = iframe?.contentDocument;
          if (!iframe || !doc?.body || !doc.documentElement) {
            throw new Error("Preview isn't ready yet.");
          }

          await new Promise((r) => requestAnimationFrame(() => r(null)));

          // Make sure every <img> has loaded — html-to-image embeds
          // bitmaps as it walks, and a not-yet-loaded <img> serializes
          // to 0×0.
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

          // Capture from <html>, not <body>: any background or padding
          // applied at the html / :root level lives outside the body box.
          const root = doc.documentElement;
          const captureWidth = Math.max(
            root.scrollWidth,
            doc.body.scrollWidth,
            renderWidth,
          );
          const captureHeight =
            renderHeight === "auto"
              ? Math.max(root.scrollHeight, doc.body.scrollHeight)
              : renderHeight;

          // Default body margin is 8px; if body is dark but html is
          // transparent, that gap renders as the canvas color. Falling
          // back through body → html → white kills the white edges.
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

          const blob = await htmlToImage.toBlob(root, {
            pixelRatio: 2,
            cacheBust: true,
            width: captureWidth,
            height: captureHeight,
            backgroundColor: canvasBg,
          });
          if (!blob) throw new Error("Failed to render PNG from preview.");
          return blob;
        },
      }),
      [renderWidth, renderHeight],
    );

    function attachInteractivity(el: HTMLElement, slug: string) {
      const isImg = el.tagName === "IMG";
      el.style.cursor = "pointer";
      el.style.transition = "outline 120ms";
      el.style.outlineOffset = "3px";
      el.style.outline = isImg ? OUTLINE_RESOLVED : OUTLINE_UNRESOLVED;

      el.addEventListener("mouseenter", () => {
        el.style.outline = isImg ? OUTLINE_HOVER_RESOLVED : OUTLINE_HOVER_UNRESOLVED;
      });
      el.addEventListener("mouseleave", () => {
        el.style.outline = isImg ? OUTLINE_RESOLVED : OUTLINE_UNRESOLVED;
      });
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSlugClickRef.current(slug);
      });
    }

    function replaceWithImg(el: HTMLElement, entity: ResolvedEntity) {
      if (!entity.logo_url) return;
      const doc = el.ownerDocument;
      const img = doc.createElement("img");
      img.setAttribute("src", entity.logo_url);
      img.setAttribute("alt", entity.slug);
      img.setAttribute("data-entity", entity.slug);
      if (el.className) img.className = el.className;
      if (el.id) img.id = el.id;

      const inline = el.getAttribute("style") ?? "";
      img.setAttribute("style", buildImgStyle(inline));

      const snapshot = originalsRef.current.get(el);
      if (snapshot) originalsRef.current.set(img, snapshot);

      el.replaceWith(img);
      attachInteractivity(img, entity.slug);
    }

    function revertToPlaceholder(el: HTMLElement) {
      const doc = el.ownerDocument;
      const original = originalsRef.current.get(el);
      if (!original) return;
      const tmp = doc.createElement("div");
      tmp.innerHTML = original;
      const fresh = tmp.firstElementChild as HTMLElement | null;
      if (!fresh) return;
      originalsRef.current.set(fresh, original);
      el.replaceWith(fresh);
      const slug = fresh.getAttribute("data-entity");
      if (slug) attachInteractivity(fresh, slug);
    }

    const iframeHeight = renderHeight === "auto" ? autoHeight : renderHeight;
    const scale =
      displayMaxWidth && displayMaxWidth < renderWidth
        ? displayMaxWidth / renderWidth
        : 1;

    if (scale === 1) {
      return (
        <div className="flex justify-center">
          <iframe
            ref={iframeRef}
            title="slide preview"
            srcDoc={srcDoc}
            sandbox="allow-same-origin allow-scripts"
            scrolling="no"
            style={{
              width: `${renderWidth}px`,
              height: `${iframeHeight}px`,
              maxWidth: "100%",
            }}
            className="block rounded-md border bg-white"
          />
        </div>
      );
    }

    // Scaled display: wrapper sizes to the visible footprint, the iframe
    // is rendered at its full renderWidth × iframeHeight and scaled down
    // via transform. transformOrigin top-left so the visible content
    // starts at the wrapper's top-left.
    return (
      <div className="flex justify-center">
        <div
          style={{
            width: `${renderWidth * scale}px`,
            height: `${iframeHeight * scale}px`,
            overflow: "hidden",
          }}
          className="rounded-md border bg-white"
        >
          <iframe
            ref={iframeRef}
            title="slide preview"
            srcDoc={srcDoc}
            sandbox="allow-same-origin allow-scripts"
            scrolling="no"
            style={{
              width: `${renderWidth}px`,
              height: `${iframeHeight}px`,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>
    );
  },
);

// Inject (or update / remove) the active theme's CSS as a tagged
// <style> element + <link rel="stylesheet"> elements (one per
// referenced Google Font) in the iframe head. <link> is used in
// addition to @import inside the <style> because dynamic @import
// (added after document load) can be flaky in some browsers — the
// <link> path always works.
//
// We append the <style> last so its `:root { --token: … }`
// declarations win over anything the source HTML defined earlier
// in its own `:root`, and we tack on a short `!important` override
// that flips body/html colors + font even when the source HTML
// hard-coded them — without that, switching themes on legacy
// generated HTML looks like nothing changed.
function applyTheme(doc: Document, css: string | null) {
  const head = doc.head ?? doc.documentElement;
  if (!head) return;
  const TAG_ATTR = "data-viral-theme";

  // Always start from a clean slate — both the style and any link
  // tags from a previous theme. If `css` is null we exit here.
  doc
    .querySelectorAll(
      `style[${TAG_ATTR}], link[${TAG_ATTR}], script[${TAG_ATTR}]`,
    )
    .forEach((el) => el.remove());
  if (!css) return;

  // Add a <link rel="stylesheet"> per Google Fonts URL the theme
  // references. These load alongside the iframe's normal stylesheet
  // chain, so the browser shows them in devtools as proper resources
  // (great for debugging "why isn't Figtree loading").
  for (const url of extractGoogleFontUrls(css)) {
    const link = doc.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", url);
    link.setAttribute(TAG_ATTR, "");
    head.appendChild(link);
  }

  const style = doc.createElement("style");
  style.setAttribute(TAG_ATTR, "");
  // Set the textContent *before* appending so the browser parses
  // the stylesheet (and registers `:root { --font-family-base }`,
  // etc.) the moment the element enters the DOM. If we append
  // empty and set textContent later, the chart-retheme script
  // below — which we want to fire as soon as it's appended —
  // would read empty custom properties and the body-font pin
  // would no-op on its first call.
  const tokens = parseCssTokens(css);
  style.textContent = [
    ensureFontImports(css),
    buildAliasBridge(tokens),
    THEME_OVERRIDES,
  ].join("\n");
  head.appendChild(style);

  // Chart.js dataset colors live in `<script>` and don't get touched
  // by the inline-style accent rewrite. This script polls for charts
  // post-load and substitutes well-known accent hex with theme
  // tokens via getComputedStyle, then calls chart.update('none').
  // It also pins body's font-family inline with !important — the
  // <style> above already does that via CSS, but the JS pin gives
  // us higher specificity for any source HTML that fights it.
  const chartScript = doc.createElement("script");
  chartScript.setAttribute(TAG_ATTR, "");
  chartScript.textContent = CHART_RETHEME_SCRIPT;
  head.appendChild(chartScript);
}

// Snapshot the iframe's current rendering state for the picker's
// diagnostics tooltip. Reads getComputedStyle for body so the user
// sees the fonts/colors actually rendering — not what the theme
// CSS *should* apply. Returns null if the iframe isn't ready
// enough to read body styles.
function captureDiagnostics(doc: Document): ThemeDiagnostics | null {
  const win = doc.defaultView;
  if (!win || !doc.body) return null;
  const cs = win.getComputedStyle(doc.body);

  // Pull the first family in the computed font-family stack —
  // quoted or unquoted, doesn't matter. Browsers vary on whether
  // they quote multi-word names in computed values, so picking
  // "first quoted" can skip past the intended primary family
  // (e.g. an unquoted `Manrope` followed by a quoted
  // `'Helvetica Neue'` later in the stack would have wrongly
  // returned "Helvetica Neue"). First-comma-entry is unambiguous.
  const familyValue = cs.fontFamily ?? "";
  const firstEntry = familyValue.split(",")[0]?.trim() ?? "";
  const fontFamily =
    firstEntry.replace(/^['"]|['"]$/g, "") || null;

  // document.fonts.check() returns true only if *every* face required
  // for the spec is loaded. Wrap in try/catch — older browsers /
  // sandboxed iframes sometimes throw on this API.
  let fontLoaded: boolean | null = null;
  if (fontFamily) {
    try {
      fontLoaded = doc.fonts?.check?.(`1em "${fontFamily}"`) ?? null;
    } catch {
      fontLoaded = null;
    }
  }

  const inlineStyled = doc.querySelectorAll('[style]');
  const tokenized = doc.querySelectorAll('[style*="var(--"]');

  const rootFontFamilyVar = win
    .getComputedStyle(doc.documentElement)
    .getPropertyValue("--font-family-base")
    .trim();
  const themeLinks = doc.querySelectorAll(
    'link[data-viral-theme]',
  ).length;

  return {
    fontFamily,
    fontLoaded,
    fontFamilyRaw: familyValue,
    rootFontFamilyVar,
    themeLinks,
    backgroundColor: cs.backgroundColor,
    color: cs.color,
    tokenizedElements: tokenized.length,
    inlineStyledElements: inlineStyled.length,
    canvases: doc.querySelectorAll("canvas").length,
  };
}

// Mirrors lib/themes.ts THEME_OVERRIDES — duplicated so this client
// component doesn't pull in the server-only prisma import chain.
// Fallback chains accept either --color-* (canonical) or the older
// --bg-canvas / --fg-primary / --font-sans names so a pasted theme
// flips colors regardless of naming convention.
const THEME_OVERRIDES = `
/* viral theme overrides — flip canvas/text/font even on HTML that
   doesn't reference these tokens directly. */
html {
  background-color: var(--color-background-primary, var(--bg-canvas)) !important;
}
body {
  background-color: var(--color-background-primary, var(--bg-canvas)) !important;
  color: var(--color-text-primary, var(--fg-primary)) !important;
  font-family: var(--font-family-base, var(--font-sans)) !important;
}
`;

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

function cssEscape(s: string): string {
  return s.replace(/(["\\])/g, "\\$1");
}
