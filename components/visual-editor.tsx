"use client";

import { useRef, useState, useTransition } from "react";
import type { ResolvedEntity } from "@/types/entity";
import { EditorPanel } from "@/components/editor-panel";
import { SlidePreview, type SlidePreviewHandle } from "@/components/slide-preview";
import { ThemePicker, type ActiveTheme } from "@/components/theme-picker";

interface Props {
  html: string;
  entities: ResolvedEntity[];
  onEntitiesChange: (next: ResolvedEntity[]) => void;
  onBack: () => void;
  // Receives both the rendered PNG blob and the active theme id so the
  // server-side render row can record which theme produced it.
  onRender: (
    png: Blob,
    entityCount: number,
    themeId: string | null,
  ) => Promise<void>;
  storageReady: boolean;
}

const RENDER_WIDTH = 720;

export function VisualEditor({
  html,
  entities,
  onEntitiesChange,
  onBack,
  onRender,
  storageReady,
}: Props) {
  const previewRef = useRef<SlidePreviewHandle>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, startRender] = useTransition();
  const [theme, setTheme] = useState<ActiveTheme | null>(null);

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
        const blob = await previewRef.current!.capture();
        await onRender(blob, entities.length, theme?.id ?? null);
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
        <div className="flex items-center gap-2">
          <ThemePicker onChange={setTheme} />
          <button
            type="button"
            onClick={startRenderClick}
            disabled={!allResolved || rendering || !storageReady}
            className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {rendering ? "Queueing..." : "Render PNG"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <SlidePreview
        ref={previewRef}
        html={html}
        entities={entities}
        onSlugClick={setActiveSlug}
        renderWidth={RENDER_WIDTH}
        renderHeight="auto"
        themeCss={theme?.css ?? null}
      />

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
