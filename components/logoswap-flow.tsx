"use client";

import { useState } from "react";
import type { ResolvedEntity } from "@/types/entity";
import { UploadDropzone } from "@/components/upload-dropzone";
import { VisualEditor } from "@/components/visual-editor";
import { RenderPoller } from "@/components/render-poller";

type Stage = "upload" | "edit" | "render";

export function LogoSwapFlow({ storageReady }: { storageReady: boolean }) {
  const [stage, setStage] = useState<Stage>("upload");
  const [html, setHtml] = useState<string>("");
  const [filename, setFilename] = useState<string | null>(null);
  const [entities, setEntities] = useState<ResolvedEntity[]>([]);
  const [renderId, setRenderId] = useState<string | null>(null);

  function reset() {
    setStage("upload");
    setHtml("");
    setFilename(null);
    setEntities([]);
    setRenderId(null);
  }

  if (stage === "render" && renderId) {
    return <RenderPoller renderId={renderId} onReset={reset} />;
  }

  if (stage === "edit") {
    return (
      <VisualEditor
        html={html}
        entities={entities}
        onEntitiesChange={setEntities}
        onBack={() => setStage("upload")}
        storageReady={storageReady}
        onRender={async (mapping) => {
          const res = await fetch("/api/render", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ html, mapping, filename }),
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
            const summary = detail.trim().slice(0, 500) || res.statusText || "no response body";
            throw new Error(`Render request failed (${res.status}): ${summary}`);
          }
          const data = await res.json();
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
