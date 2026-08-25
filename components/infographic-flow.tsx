"use client";

import { useEffect, useState } from "react";
import type { ResolvedEntity } from "@/types/entity";
import { UploadDropzone } from "@/components/upload-dropzone";
import { VisualEditor } from "@/components/visual-editor";
import { RenderResult } from "@/components/render-result";
import { TutorialEmbed } from "@/components/tutorial-embed";

type Stage = "upload" | "edit" | "render";

interface Props {
  storageReady: boolean;
  // When set, the flow skips the dropzone and re-loads a past
  // render's source HTML directly into the editor. Set by
  // ModeSwitcher when the URL has `?remix=<id>&format=single`.
  remixId?: string | null;
  // Whether the walkthrough starts expanded rather than collapsed to
  // its button. Resolved server-side in the page.
  showTutorial?: boolean;
}

export function InfographicFlow({
  storageReady,
  remixId,
  showTutorial = false,
}: Props) {
  const [stage, setStage] = useState<Stage>(remixId ? "edit" : "upload");
  const [html, setHtml] = useState<string>("");
  const [filename, setFilename] = useState<string | null>(null);
  const [entities, setEntities] = useState<ResolvedEntity[]>([]);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [remixError, setRemixError] = useState<string | null>(null);
  const [remixLoading, setRemixLoading] = useState(Boolean(remixId));

  // Remix loader: fetch the saved source HTML, run /api/parse to
  // get the entity list (re-resolved against the user's current
  // library), seed editor state, jump straight to the edit stage.
  // Skipping the dropzone is the whole point — Remix is a
  // one-click "open this past post" flow.
  useEffect(() => {
    if (!remixId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/render/${remixId}?include=source`);
        if (!res.ok) throw new Error(`Couldn't fetch render (${res.status}).`);
        const data = await res.json();
        const slides = (data.source_html?.slides ?? []) as Array<{
          filename: string;
          html: string;
        }>;
        const slide = slides[0];
        if (!slide?.html)
          throw new Error("This render has no source HTML to remix.");

        const parseRes = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: slide.html }),
        });
        if (!parseRes.ok) throw new Error(`Couldn't parse the source HTML.`);
        const parsed = await parseRes.json();
        if (cancelled) return;
        setHtml(slide.html);
        setFilename(data.filename ?? slide.filename ?? null);
        setEntities(parsed.entities);
        setStage("edit");
      } catch (err) {
        if (!cancelled) setRemixError((err as Error).message);
      } finally {
        if (!cancelled) setRemixLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remixId]);

  function reset() {
    setStage("upload");
    setHtml("");
    setFilename(null);
    setEntities([]);
    setPngUrl(null);
    setRenderId(null);
  }

  if (remixLoading) {
    return (
      <p className="border bg-card p-6 text-sm text-muted-foreground">
        Loading remix…
      </p>
    );
  }
  if (remixError) {
    return (
      <div className="space-y-3 border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <p>{remixError}</p>
        <button
          type="button"
          onClick={() => {
            setRemixError(null);
            setStage("upload");
          }}
          className="inline-flex h-9 items-center border px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none focus-visible:border-ring"
        >
          Start a new post instead
        </button>
      </div>
    );
  }

  if (stage === "render" && pngUrl && renderId) {
    return (
      <RenderResult
        renderId={renderId}
        url={pngUrl}
        kind="png"
        onReset={reset}
      />
    );
  }

  if (stage === "edit") {
    return (
      <VisualEditor
        html={html}
        entities={entities}
        onEntitiesChange={setEntities}
        onBack={() => setStage("upload")}
        storageReady={storageReady}
        onRender={async (png, entityCount, themeId) => {
          const form = new FormData();
          form.append("file", png, filename ? `${filename}.png` : "render.png");
          if (filename) form.append("filename", filename);
          form.append("entity_count", String(entityCount));
          if (themeId) form.append("theme_id", themeId);
          // Send the source HTML (with data-entity placeholders
          // intact) so this render can be reopened via Remix later
          // without re-uploading from Claude.
          if (html) form.append("source_html", html);

          const res = await fetch("/api/render", {
            method: "POST",
            body: form,
          });
          if (!res.ok) {
            const raw = await res.text().catch(() => "");
            let detail = raw;
            try {
              const data = JSON.parse(raw);
              if (typeof data?.error === "string") detail = data.error;
              else if (data?.error) detail = JSON.stringify(data.error);
            } catch {
              // raw wasn't JSON — keep the body text as-is
            }
            const summary =
              detail.trim().slice(0, 500) ||
              res.statusText ||
              "no response body";
            throw new Error(`Render upload failed (${res.status}): ${summary}`);
          }
          const data = await res.json();
          setPngUrl(data.png_url);
          setRenderId(data.render_id);
          setStage("render");
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <TutorialEmbed defaultOpen={showTutorial} />
      <UploadDropzone
        onParsed={(parsed, parsedHtml, name) => {
          setHtml(parsedHtml);
          setFilename(name);
          setEntities(parsed);
          setStage("edit");
        }}
      />
    </div>
  );
}
