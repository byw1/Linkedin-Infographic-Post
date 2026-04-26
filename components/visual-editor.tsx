"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ResolvedEntity } from "@/types/entity";
import { replaceEntities } from "@/lib/replacer";
import { EditorPanel } from "@/components/editor-panel";

interface Props {
  html: string;
  entities: ResolvedEntity[];
  onEntitiesChange: (next: ResolvedEntity[]) => void;
  onBack: () => void;
  onRender: (mapping: Record<string, string>) => Promise<void>;
  storageReady: boolean;
}

export function VisualEditor({
  html,
  entities,
  onEntitiesChange,
  onBack,
  onRender,
  storageReady,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, startRender] = useTransition();

  // Apply resolved logos to the HTML so the iframe shows them in place.
  // Unresolved placeholders keep their green divs and stay clickable.
  const renderedHtml = useMemo(() => {
    const mapping: Record<string, string> = {};
    for (const e of entities) {
      if (e.resolved && e.logo_url) mapping[e.slug] = e.logo_url;
    }
    return replaceEntities(html, mapping);
  }, [html, entities]);

  // After the iframe (re)loads, attach click handlers + visual outlines to
  // every [data-entity] element. Clicking opens the editor panel for that
  // slug.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handlersToCleanup: Array<{
      el: Element;
      type: string;
      fn: EventListener;
    }> = [];

    function setup() {
      const doc = iframe!.contentDocument;
      if (!doc) return;

      // Make the body cooperate with our overlay sizing.
      if (doc.body) doc.body.style.margin = "0";

      doc.querySelectorAll<HTMLElement>("[data-entity]").forEach((el) => {
        const slug = el.getAttribute("data-entity");
        if (!slug || slug.startsWith("unknown")) return;

        const isImg = el.tagName === "IMG";

        el.style.cursor = "pointer";
        el.style.transition = "outline 120ms, outline-offset 120ms";
        el.style.outlineOffset = "3px";
        el.style.outline = isImg ? "0 solid transparent" : "2px dashed #f59e0b";

        const onEnter: EventListener = () => {
          el.style.outline = isImg ? "2px solid #6366f1" : "2px solid #f59e0b";
        };
        const onLeave: EventListener = () => {
          el.style.outline = isImg ? "0 solid transparent" : "2px dashed #f59e0b";
        };
        const onClick: EventListener = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setActiveSlug(slug);
        };

        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);
        el.addEventListener("click", onClick);
        handlersToCleanup.push({ el, type: "mouseenter", fn: onEnter });
        handlersToCleanup.push({ el, type: "mouseleave", fn: onLeave });
        handlersToCleanup.push({ el, type: "click", fn: onClick });
      });
    }

    iframe.addEventListener("load", setup);
    if (iframe.contentDocument?.readyState === "complete") setup();

    return () => {
      iframe.removeEventListener("load", setup);
      for (const { el, type, fn } of handlersToCleanup) {
        el.removeEventListener(type, fn);
      }
    };
  }, [renderedHtml]);

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
          srcDoc={renderedHtml}
          // allow-scripts so embedded chart libraries (Chart.js, etc.) render
          // in the preview the same way they will in the exported PNG. We keep
          // allow-same-origin so this component can attach click handlers to
          // [data-entity] elements inside.
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
