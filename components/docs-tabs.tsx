"use client";

import { useEffect, useState } from "react";
import { DocsView } from "@/components/docs-view";
import { SkillsSection } from "@/components/skills-section";

interface DocsRecord {
  markdown: string;
  updatedAt: string | null;
  updatedById: string | null;
  updatedByName: string | null;
}

type Tab = "handbook" | "skills";
const TABS: Tab[] = ["handbook", "skills"];

const TAB_LABEL: Record<Tab, string> = {
  handbook: "Handbook",
  skills: "Skills",
};

const TAB_BLURB: Record<Tab, (canEdit: boolean) => string> = {
  handbook: (canEdit) =>
    canEdit
      ? "Team-wide notes. Anyone signed in reads, you edit."
      : "Team-wide notes. Only admins can edit.",
  skills: (canEdit) =>
    canEdit
      ? "Markdown skill files for Claude. Upload one and the team can grab it."
      : "Markdown skill files for Claude. Download to use with Claude Projects or Claude Code.",
};

export function DocsTabs({
  initialDocs,
  initialDocsCustomized,
  canEdit,
}: {
  initialDocs: DocsRecord;
  initialDocsCustomized: boolean;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<Tab>("handbook");

  // Initial tab from the URL — keeps deep links honest. We avoid
  // touching server props on hash change; useEffect runs after mount.
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("tab");
    if (t && TABS.includes(t as Tab)) setTab(t as Tab);
  }, []);

  function selectTab(next: Tab) {
    setTab(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="inline-flex rounded-md border p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => selectTab(t)}
              className={`rounded-sm px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{TAB_BLURB[tab](canEdit)}</p>
      </div>

      {tab === "handbook" ? (
        <DocsView
          initial={initialDocs}
          initialCustomized={initialDocsCustomized}
          canEdit={canEdit}
        />
      ) : (
        <SkillsSection canManage={canEdit} />
      )}
    </div>
  );
}
