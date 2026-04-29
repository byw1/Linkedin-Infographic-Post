"use client";

import { useState } from "react";
import { InfographicFlow } from "@/components/infographic-flow";
import { CarouselFlow } from "@/components/carousel-flow";

type Mode = "infographic" | "carousel";

const MODE_COPY: Record<Mode, string> = {
  infographic:
    "Drop a single HTML file with data-entity placeholders. Resolve any unknown logos, render, download a PNG.",
  carousel:
    "Drop a .zip of 1080×1080 HTML slides — one slide per file. Resolve unknown logos once across the whole set, then export a single PDF (one page per slide) ready to upload as a LinkedIn document.",
};

export function ModeSwitcher({ storageReady }: { storageReady: boolean }) {
  const [mode, setMode] = useState<Mode>("infographic");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="inline-flex rounded-md border p-1">
          <ModeTab active={mode === "infographic"} onClick={() => setMode("infographic")}>
            Infographic
          </ModeTab>
          <ModeTab active={mode === "carousel"} onClick={() => setMode("carousel")}>
            Carousel
          </ModeTab>
        </div>
        <p className="text-sm text-muted-foreground">{MODE_COPY[mode]}</p>
      </div>

      {mode === "infographic" ? (
        <InfographicFlow storageReady={storageReady} />
      ) : (
        <CarouselFlow storageReady={storageReady} />
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
