"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as htmlToImage from "html-to-image";
import type { ResolvedEntity } from "@/types/entity";
import { EditorPanel } from "@/components/editor-panel";

interface Props {
  html: string;
  entities: ResolvedEntity[];
  onEntitiesChange: (next: ResolvedEntity[]) => void;
  onBack: () => void;
  onRender: (png: Blob, entityCount: number) => Promise<void>;
  storageReady: boolean;
}

const OUTLINE_UNRESOLVED = "2px dashed #f59e0b";
const OUTLINE_RESOLVED = "0 solid transparent";
const OUTLINE_HOVER_UNRESOLVED = "2px solid #f59e0b";
const OUTLINE_HOVER_RESOLVED = "2px solid #6366f1";

export function VisualEditor({
  html,
  entities,
  onEntitiesChange,
  onBack,
  onRender,
  storageReady,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Per-element snapshot of the original placeholder HTML, used to revert
  // on unresolve. WeakMap so we can transfer the snapshot from the
  // placeholder div to its <img> replacement and back.
  const originalsRef = useRef<WeakMap<Element, string>>(new WeakMap());
  const onSlugClickRef = useRef<(slug: string) => void>(() => {});
  const entitiesRef = useRef<ResolvedEntity[]>(entities);
  entitiesRef.current = entities;
  const observersRef = useRef<{ ro?: ResizeObserver; mo?: MutationObserver }>({});

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, startRender] = useTransition();
  const [iframeReady, setIframeReady] = useState(false);
  // Lock width to the export width so the iframe lays out at the same size
  // we'll snapshot. Letting it shrink-wrap to body.scrollWidth collapses to
  // ~content width whenever the user's HTML uses flex/inline-block.
  const RENDER_WIDTH = 720;
  const [contentHeight, setContentHeight] = useState<number>(600);

  // srcDoc is computed exactly once per uploaded HTML. Entity changes are
  // applied imperatively to the iframe DOM below — keeps scroll position
  // and stops charts from re-animating on every edit.
  const srcDoc = useMemo(() => html, [html]);

  onSlugClickRef.current = setActiveSlug;

  // Initial setup: snapshot every placeholder, attach handlers, and apply
  // any entities already marked resolved (which is the common case — the
  // library auto-resolves them on parse).
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function setup() {
      const doc = iframe!.contentDocument;
      if (!doc) return;

      originalsRef.current = new WeakMap();

      const all = Array.from(
        doc.querySelectorAll<HTMLElement>("[data-entity]"),
      ).filter((el) => {
        const slug = el.getAttribute("data-entity");
        return slug && !slug.startsWith("unknown");
      });

      // Snapshot every placeholder before any mutation.
      for (const el of all) {
        originalsRef.current.set(el, el.outerHTML);
      }

      // Apply current resolutions or attach handlers, in document order so
      // multiple instances of the same slug each get the right element.
      const resolvedBySlug = new Map<string, ResolvedEntity>();
      for (const e of entitiesRef.current) {
        if (e.resolved && e.logo_url) resolvedBySlug.set(e.slug, e);
      }

      for (const el of all) {
        const slug = el.getAttribute("data-entity")!;
        const entity = resolvedBySlug.get(slug);
        if (entity) {
          replaceWithImg(el, entity);
        } else {
          attachInteractivity(el, slug);
        }
      }

      // Width is fixed (matches the worker's viewport); only track height so
      // the iframe grows to fit the laid-out content without clipping.
      const measure = () => {
        if (!doc.body || !doc.documentElement) return;
        const body = doc.body;
        const root = doc.documentElement;
        const height = Math.max(body.scrollHeight, body.offsetHeight, root.scrollHeight);
        setContentHeight((prev) => (prev === height ? prev : height));
      };
      measure();
      // Re-measure when content (charts, images, replaced logos) changes.
      const ro = new ResizeObserver(measure);
      ro.observe(doc.body);
      ro.observe(doc.documentElement);
      // Mutation observer catches our own DOM swaps too.
      const mo = new MutationObserver(measure);
      mo.observe(doc.body, { childList: true, subtree: true, attributes: true });
      observersRef.current = { ro, mo };

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
  }, [srcDoc]);

  // Subsequent edits — diff entities state against iframe DOM and apply
  // changes without rebuilding srcDoc.
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

  const total = entities.length;
  const resolvedCount = entities.filter((e) => e.resolved).length;
  const allResolved = total > 0 && resolvedCount === total;
  const activeEntity = activeSlug ? entities.find((e) => e.slug === activeSlug) : null;

  function update(slug: string, patch: Partial<ResolvedEntity>) {
    const next = entities.map((e) => (e.slug === slug ? { ...e, ...patch } : e));
    onEntitiesChange(next);
  }

  function startRenderClick() {
    setError(null);
    if (!allResolved) return;
    if (!storageReady) {
      setError("Storage isn't configured. PNG export is disabled.");
      return;
    }
    startRender(async () => {
      try {
        const blob = await captureIframe();
        await onRender(blob, entities.length);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  async function captureIframe(): Promise<Blob> {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body || !doc.documentElement) {
      throw new Error("Preview isn't ready yet.");
    }

    // Wait one frame for any pending DOM swaps to settle.
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    // Make sure every <img> inside the preview has actually loaded —
    // html-to-image embeds bitmaps as it walks the DOM, and a
    // not-yet-loaded <img> would serialize to a 0×0 placeholder.
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

    // Capture from <html>, not <body>: any background or padding the user
    // applies at the html / :root level (common in LinkedIn templates that
    // tint the page outside the card) lives outside the body box.
    // Use scroll* dims so content that overflows the viewport even by a
    // few pixels (rounding, hairline borders) doesn't get cropped on the
    // right edge — html-to-image otherwise defaults to offsetWidth/Height.
    const root = doc.documentElement;
    const width = Math.max(root.scrollWidth, doc.body.scrollWidth, RENDER_WIDTH);
    const height = Math.max(root.scrollHeight, doc.body.scrollHeight);

    const blob = await htmlToImage.toBlob(root, {
      pixelRatio: 2,
      cacheBust: true,
      width,
      height,
      // Fallback for transparent regions of the capture; matches the iframe
      // element's bg-white so a user HTML without its own background stays
      // visually identical between preview and PNG.
      backgroundColor: "#ffffff",
    });
    if (!blob) throw new Error("Failed to render PNG from preview.");
    return blob;
  }

  // ---- iframe DOM helpers --------------------------------------------------

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

    // Carry the original snapshot over so unresolve can restore the right
    // placeholder for THIS instance (slugs may appear multiple times with
    // different inline sizes).
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Use a different file
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
          {rendering ? "Queueing..." : "Render PNG"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-center">
        <iframe
          ref={iframeRef}
          title="infographic preview"
          srcDoc={srcDoc}
          // allow-scripts so embedded chart libraries (Chart.js, etc.) render
          // in the preview the same way they will in the exported PNG. We keep
          // allow-same-origin so this component can attach click handlers to
          // [data-entity] elements inside.
          sandbox="allow-same-origin allow-scripts"
          scrolling="no"
          style={{
            width: `${RENDER_WIDTH}px`,
            height: `${contentHeight}px`,
            maxWidth: "100%",
          }}
          className="block rounded-md border bg-white"
        />
      </div>

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

// Style builder mirroring lib/replacer.ts but operating on a raw style
// string (since we can't import cheerio in the browser).
function buildImgStyle(inline: string): string {
  const width = parseStyleValue(inline, "width");
  const height = parseStyleValue(inline, "height");
  const borderRadius = parseStyleValue(inline, "border-radius");
  const margin = parseStyleValue(inline, "margin-bottom");
  const flexShrink = parseStyleValue(inline, "flex-shrink");

  return [
    width && `width:${width}`,
    height && `height:${height}`,
    borderRadius && `border-radius:${borderRadius}`,
    margin && `margin-bottom:${margin}`,
    flexShrink && `flex-shrink:${flexShrink}`,
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
