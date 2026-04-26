"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ResolvedEntity } from "@/types/entity";
import { EditorPanel } from "@/components/editor-panel";

interface Props {
  html: string;
  entities: ResolvedEntity[];
  onEntitiesChange: (next: ResolvedEntity[]) => void;
  onBack: () => void;
  onRender: (mapping: Record<string, string>) => Promise<void>;
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

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, startRender] = useTransition();
  const [iframeReady, setIframeReady] = useState(false);

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
      if (doc.body) doc.body.style.margin = "0";

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

      setIframeReady(true);
    }

    iframe.addEventListener("load", setup);
    if (iframe.contentDocument?.readyState === "complete") setup();

    return () => {
      iframe.removeEventListener("load", setup);
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
    const mapping: Record<string, string> = {};
    for (const e of entities) {
      if (e.logo_url) mapping[e.slug] = e.logo_url;
    }
    startRender(async () => {
      try {
        await onRender(mapping);
      } catch (err) {
        setError((err as Error).message);
      }
    });
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

      <div className="overflow-hidden rounded-lg border bg-muted">
        <iframe
          ref={iframeRef}
          title="infographic preview"
          srcDoc={srcDoc}
          sandbox="allow-same-origin allow-scripts"
          className="h-[80vh] w-full bg-white"
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
