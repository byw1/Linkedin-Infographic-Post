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
import type { ResolvedEntity } from "@/types/entity";

const OUTLINE_UNRESOLVED = "2px dashed #f59e0b";
const OUTLINE_RESOLVED = "0 solid transparent";
const OUTLINE_HOVER_UNRESOLVED = "2px solid #f59e0b";
const OUTLINE_HOVER_RESOLVED = "2px solid #6366f1";

export interface SlidePreviewHandle {
  capture(): Promise<Blob>;
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
    },
    ref,
  ) {
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

        setIframeReady(true);
      }

      iframe.addEventListener("load", setup);
      if (iframe.contentDocument?.readyState === "complete") setup();

      return () => {
        iframe.removeEventListener("load", setup);
        observersRef.current.ro?.disconnect();
        observersRef.current.mo?.disconnect();
        observersRef.current = {};
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
    }, [themeCss, iframeReady]);

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
// <style> element in the iframe head. We append it last so its
// `:root { --token: … }` declarations win over anything the source
// HTML defined earlier in its own `:root`.
function applyTheme(doc: Document, css: string | null) {
  const head = doc.head ?? doc.documentElement;
  if (!head) return;
  const TAG_ATTR = "data-viral-theme";
  let existing = doc.querySelector(`style[${TAG_ATTR}]`);
  if (!css) {
    existing?.remove();
    return;
  }
  if (!existing) {
    existing = doc.createElement("style");
    existing.setAttribute(TAG_ATTR, "");
    head.appendChild(existing);
  } else if (existing.parentElement !== head || existing.nextSibling) {
    // Move to the end so cascade order stays predictable when the
    // source HTML mutates after first paint.
    head.appendChild(existing);
  }
  existing.textContent = css;
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

function cssEscape(s: string): string {
  return s.replace(/(["\\])/g, "\\$1");
}
