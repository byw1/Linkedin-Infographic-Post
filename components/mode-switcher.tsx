"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InfographicFlow } from "@/components/infographic-flow";
import { CarouselFlow } from "@/components/carousel-flow";
import { TweetFlow } from "@/components/tweet-flow";
import { Segmented } from "@/components/ui/segmented";

type Mode = "infographic" | "carousel" | "tweet";

const MODE_OPTIONS = [
  { value: "infographic" as const, label: "Infographic" },
  { value: "carousel" as const, label: "Carousel" },
  { value: "tweet" as const, label: "Tweet" },
];

// What each mode actually produces. Kept to one short line — the
// step-by-step explanation belongs in the flow's own card header, and
// repeating it here just pushed the real work below the fold.
const MODE_META: Record<Mode, string> = {
  infographic: "Exports a single 1080×1350 PNG",
  carousel: "Exports a multi-page PDF — one page per slide",
  tweet: "Exports a 1080×1350 PNG",
};

export function ModeSwitcher({
  storageReady,
  showTutorial,
}: {
  storageReady: boolean;
  // True only when the viewer has no posts yet and hasn't dismissed the
  // walkthrough. Infographic mode owns it — the other two flows work
  // differently enough that this video wouldn't be describing them.
  showTutorial: boolean;
}) {
  const [mode, setMode] = useState<Mode>("infographic");
  const searchParams = useSearchParams();
  // ?remix=<id> + ?format=<single|carousel|tweet> arrive when the
  // user clicks Remix on /posts. We preselect the matching editor
  // mode so the flow component renders directly. Tweet renders are
  // not currently remixable (no source HTML stored), so the tweet
  // case stays user-driven only.
  const remixId = searchParams.get("remix");
  const remixFormat = searchParams.get("format");

  useEffect(() => {
    if (remixFormat === "carousel") setMode("carousel");
    else if (remixFormat === "single") setMode("infographic");
  }, [remixFormat]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Segmented
          value={mode}
          onValueChange={setMode}
          layoutId="mode-switcher-pill"
          options={MODE_OPTIONS}
        />
        <p className="text-xs text-muted-foreground">{MODE_META[mode]}</p>
      </div>

      {mode === "infographic" ? (
        <InfographicFlow
          storageReady={storageReady}
          remixId={remixFormat === "single" ? remixId : null}
          showTutorial={showTutorial}
        />
      ) : mode === "carousel" ? (
        <CarouselFlow
          storageReady={storageReady}
          remixId={remixFormat === "carousel" ? remixId : null}
        />
      ) : (
        <TweetFlow storageReady={storageReady} />
      )}
    </div>
  );
}

