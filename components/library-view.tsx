"use client";

import { useState } from "react";
import { LibraryGrid } from "@/components/library-grid";
import { DuplicateSuggestions } from "@/components/duplicate-suggestions";

// Wraps the suggestions panel and the library grid so a merge can
// force the grid to re-pull. The grid itself manages its own search
// state internally, so we re-mount it via a bumping key — cheap and
// avoids plumbing a refresh prop through the whole component.
export function LibraryView() {
  const [version, setVersion] = useState(0);

  return (
    <div className="space-y-4">
      <DuplicateSuggestions onChange={() => setVersion((v) => v + 1)} />
      <LibraryGrid key={version} />
    </div>
  );
}
