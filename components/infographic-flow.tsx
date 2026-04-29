"use client";

import { useState } from "react";
import type { ResolvedEntity } from "@/types/entity";
import { UploadDropzone } from "@/components/upload-dropzone";
import { VisualEditor } from "@/components/visual-editor";
import { RenderResult } from "@/components/render-result";

type Stage = "upload" | "edit" | "render";

export function InfographicFlow({ storageReady }: { storageReady: boolean }) {
  const [stage, setStage] = useState<Stage>("upload");
  const [html, setHtml] = useState<string>("");
  const [filename, setFilename] = useState<string | null>(null);
  const [entities, setEntities] = useState<ResolvedEntity[]>([]);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [renderId, setRenderId] = useState<string | null>(null);

  function reset() {
    setStage("upload");
    setHtml("");
    setFilename(null);
    setEntities([]);
    setPngUrl(null);
    setRenderId(null);
  }

  if (stage === "render" && pngUrl && renderId) {
    return (
      <RenderResult renderId={renderId} url={pngUrl} kind="png" onReset={reset} />
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
        onRender={async (png, entityCount) => {
          const form = new FormData();
          form.append("file", png, filename ? `${filename}.png` : "render.png");
          if (filename) form.append("filename", filename);
          form.append("entity_count", String(entityCount));

          const res = await fetch("/api/render", { method: "POST", body: form });
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
            const summary = detail.trim().slice(0, 500) || res.statusText || "no response body";
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
    <UploadDropzone
      onParsed={(parsed, parsedHtml, name) => {
        setHtml(parsedHtml);
        setFilename(name);
        setEntities(parsed);
        setStage("edit");
      }}
    />
  );
}
