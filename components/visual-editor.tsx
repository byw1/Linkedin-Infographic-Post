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
  const originalHtmlRef = useRef<Map<string, string>>(new Map());
  const onSlugClickRef = useRef<(slug: string) => void>(() => {});

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, startRender] = useTransition();
  const [iframeReady, setIframeReady] = useState(false);

  // srcDoc is computed exactly once per uploaded HTML. Entity changes are
  // applied imperatively to the iframe DOM below — that's what stops the
  // scroll from jumping back to the top and the charts from re-animating.
  const srcDoc = useMemo(() => html, [html]);

  // Keep the click handler ref pointing at the current setActiveSlug.
  onSlugClickRef.current = setActiveSlug;

  // Initial setup: snapshot every placeholder's outerHTML so we can revert
  // on unresolve, and attach click + outline handlers to each.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function setup() {
      const doc = iframe!.contentDocument;
      if (!doc) return;
      if (doc.body) doc.body.style.margin = "0";

      originalHtmlRef.current.clear();

      doc.querySelectorAll<HTMLElement>("[data-entity]").forEach((el) => {
        const slug = el.getAttribute("data-entity");
        if (!slug || slug.startsWith("unknown")) return;
        if (!originalHtmlRef.current.has(slug)) {
          originalHtmlRef.current.set(slug, el.outerHTML);
        }
        attachInteractivity(el, slug);
      });

      setIframeReady(true);
    }

    iframe.addEventListener("load", setup);
    if (iframe.contentDocument?.readyState === "complete") setup();

    return () => {
      iframe.removeEventListener("load", setup);
      setIframeReady(false);
    };
  }, [srcDoc]);

  // Each time entities change, mutate the iframe DOM so it matches the
  // current resolution state. Doesn't trigger an iframe reload.
  useEffect(() => {
    if (!iframeReady) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    for (const e of entities) {
      const el = doc.querySelector<HTMLElement>(`[data-entity="${cssEscape(e.slug)}"]`);
      if (!el) continue;
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
        revertToPlaceholder(el, e.slug);
      }
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

    el.replaceWith(img);
    attachInteractivity(img, entity.slug);
  }

  function revertToPlaceholder(el: HTMLElement, slug: string) {
    const doc = el.ownerDocument;
    const original = originalHtmlRef.current.get(slug);
    if (!original) return;
    const tmp = doc.createElement("div");
    tmp.innerHTML = original;
    const fresh = tmp.firstElementChild as HTMLElement | null;
    if (!fresh) return;
    el.replaceWith(fresh);
    attachInteractivity(fresh, slug);
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
// string (since we can't import cheerio in the browser). Keeps the
// editor preview byte-equivalent to what the worker will render.
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

// Minimal CSS.escape polyfill for slug values (alphanumeric + dashes only).
function cssEscape(s: string): string {
  return s.replace(/(["\\])/g, "\\$1");
}
