"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Info,
  Lightbulb,
  Wrench,
} from "lucide-react";

interface ToolRef {
  id: string;
  name: string;
  url: string;
  description: string | null;
  logoUrl: string | null;
}

interface SkillRef {
  id: string;
  name: string;
  description: string | null;
  filename: string;
}

// Markdown renderer with two custom rules on top of standard
// react-markdown + remark-gfm:
//
// 1. Inline tool / skill cards. Authors link to a tool with
//    `[Display text](tool:<id>)` (or `skill:<id>`) and the link
//    renders as a compact card instead of a plain anchor. We fetch
//    the catalog once on mount and look up by id; unknown ids fall
//    back to the original anchor with a "?" hint so the page
//    doesn't break on stale references.
//
// 2. GitHub-style callouts. A blockquote whose first line is one
//    of `[!note]`, `[!tip]`, `[!warning]`, `[!important]` renders
//    as a styled callout. Standard blockquotes still work for the
//    quote use case.
export function DocsMarkdown({ markdown }: { markdown: string }) {
  const [tools, setTools] = useState<Record<string, ToolRef>>({});
  const [skills, setSkills] = useState<Record<string, SkillRef>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [toolsRes, skillsRes] = await Promise.all([
        fetch("/api/tools").catch(() => null),
        fetch("/api/skills").catch(() => null),
      ]);
      if (cancelled) return;
      if (toolsRes?.ok) {
        const data = await toolsRes.json();
        const map: Record<string, ToolRef> = {};
        for (const t of data.tools as ToolRef[]) map[t.id] = t;
        setTools(map);
      }
      if (skillsRes?.ok) {
        const data = await skillsRes.json();
        const map: Record<string, SkillRef> = {};
        for (const s of data.skills as SkillRef[]) map[s.id] = s;
        setSkills(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const components: Components = useMemo(
    () => ({
      a({ href, children, ...rest }) {
        if (typeof href === "string") {
          if (href.startsWith("tool:")) {
            const id = href.slice("tool:".length).trim();
            return (
              <ToolInlineCard
                id={id}
                tool={tools[id]}
                fallbackLabel={
                  typeof children === "string" ? children : undefined
                }
              />
            );
          }
          if (href.startsWith("skill:")) {
            const id = href.slice("skill:".length).trim();
            return (
              <SkillInlineCard
                id={id}
                skill={skills[id]}
                fallbackLabel={
                  typeof children === "string" ? children : undefined
                }
              />
            );
          }
        }
        return (
          <a href={href} {...rest}>
            {children}
          </a>
        );
      },
      blockquote({ children, ...rest }) {
        // Detect a callout marker in the first paragraph's first
        // text node. The marker is GitHub-flavored: `[!note]`,
        // `[!tip]`, `[!warning]`, `[!important]`. If found, peel
        // it off the content and render the styled callout.
        const detected = detectCallout(children);
        if (detected) {
          const { kind, content } = detected;
          return <Callout kind={kind}>{content}</Callout>;
        }
        return <blockquote {...rest}>{children}</blockquote>;
      },
    }),
    [tools, skills],
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      urlTransform={transformDocUrl}
    >
      {markdown}
    </ReactMarkdown>
  );
}

// react-markdown sanitizes URLs with non-http(s) schemes by default,
// which strips our `tool:` and `skill:` links before the custom <a>
// renderer ever sees them. Pass them through unchanged; everything
// else falls back to the library default (relative + http/https/
// mailto/tel/sms allowed, javascript:/data: blocked).
const SAFE_PROTOCOL = /^(?:https?|mailto|tel|sms):/i;
function transformDocUrl(url: string): string {
  if (url.startsWith("tool:") || url.startsWith("skill:")) return url;
  if (url.startsWith("#") || url.startsWith("/") || url.startsWith("./")) {
    return url;
  }
  if (SAFE_PROTOCOL.test(url)) return url;
  // Anything else (including raw `javascript:` / `data:`) — drop it.
  return "";
}

// ---------- callouts -------------------------------------------------

type CalloutKind = "note" | "tip" | "warning" | "important";

const CALLOUT_META: Record<
  CalloutKind,
  { label: string; icon: React.ReactNode; cls: string }
> = {
  note: {
    label: "Note",
    icon: <Info size={14} aria-hidden />,
    cls: "border-chalk/40 bg-chalk/10 text-chalk",
  },
  tip: {
    label: "Tip",
    icon: <Lightbulb size={14} aria-hidden />,
    cls: "border-chalk/40 bg-chalk/10 text-chalk",
  },
  warning: {
    label: "Warning",
    icon: <AlertTriangle size={14} aria-hidden />,
    cls: "border-signal/40 bg-off-black/10 text-signal",
  },
  important: {
    label: "Important",
    icon: <AlertTriangle size={14} aria-hidden />,
    cls: "border-signal/40 bg-off-black/10 text-signal",
  },
};

function Callout({
  kind,
  children,
}: {
  kind: CalloutKind;
  children: React.ReactNode;
}) {
  const meta = CALLOUT_META[kind];
  return (
    <div className={`docs-callout my-4 border ${meta.cls} px-4 py-3`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
        {meta.icon}
        {meta.label}
      </div>
      <div className="docs-callout-body text-sm">{children}</div>
    </div>
  );
}

// Look at the blockquote's children to find a leading `[!kind]`
// token. react-markdown renders a blockquote as a list of
// <p> nodes; we walk the first paragraph's children to peel the
// marker. Returns null when nothing matches so the caller can
// render a normal blockquote.
function detectCallout(
  children: React.ReactNode,
): { kind: CalloutKind; content: React.ReactNode } | null {
  const arr = Array.isArray(children) ? [...children] : [children];
  // Skip leading whitespace strings react-markdown sometimes
  // emits between tags.
  let firstIdx = arr.findIndex(
    (c) => !(typeof c === "string" && /^\s*$/.test(c)),
  );
  if (firstIdx === -1) return null;
  const first = arr[firstIdx];
  if (!isElement(first) || first.props == null) return null;
  const innerChildren = (first.props as { children?: React.ReactNode })
    .children;
  const innerArr = Array.isArray(innerChildren)
    ? [...innerChildren]
    : [innerChildren];
  const firstText = innerArr[0];
  if (typeof firstText !== "string") return null;
  const match = firstText.match(
    /^\s*\[!(note|tip|warning|important)\]\s*\n?(.*)$/is,
  );
  if (!match) return null;
  const kind = match[1].toLowerCase() as CalloutKind;
  const remainingText = match[2] ?? "";
  const newFirstP = {
    ...(first as React.ReactElement),
    props: {
      ...(first.props as object),
      children: [remainingText, ...innerArr.slice(1)],
    },
  } as React.ReactElement;
  arr[firstIdx] = newFirstP;
  return { kind, content: arr };
}

function isElement(value: unknown): value is React.ReactElement {
  return (
    typeof value === "object" && value !== null && "props" in (value as object)
  );
}

// ---------- inline tool card ----------------------------------------

function ToolInlineCard({
  id,
  tool,
  fallbackLabel,
}: {
  id: string;
  tool: ToolRef | undefined;
  fallbackLabel?: string;
}) {
  if (!tool) {
    // Catalog hasn't loaded yet OR id is stale. Render a ghost
    // pill with the label the author wrote so the layout doesn't
    // jump and the broken reference is obvious.
    return (
      <span className="inline-flex h-7 items-center gap-1.5 border border-dashed bg-secondary/40 px-2 align-middle text-xs text-muted-foreground">
        <Wrench size={12} aria-hidden />
        {fallbackLabel || `tool:${id}`}
        <span className="text-[10px] text-muted-foreground/70">?</span>
      </span>
    );
  }
  const logo =
    tool.logoUrl ??
    (() => {
      try {
        const u = new URL(tool.url);
        return `https://www.google.com/s2/favicons?domain=${u.host}&sz=64`;
      } catch {
        return null;
      }
    })();
  // No favicon → first letter of the tool name as a white-text
  // initial chip on a colored tile so the row still has a visual
  // anchor.
  const initial = (tool.name || "?").trim().charAt(0).toUpperCase();
  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      title={tool.name}
      className="docs-tool-link inline-flex items-center gap-2 border-2 border-primary/25 bg-card px-2.5 py-1 align-middle text-sm font-semibold text-card-foreground no-underline hover:border-primary/70 hover:bg-accent hover:text-accent-foreground"
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden bg-primary text-[10px] font-semibold uppercase leading-none text-primary-foreground"
        aria-hidden
      >
        {logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logo}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              // Hide a broken favicon so the white-text initial
              // shows through underneath.
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-chalk">{initial}</span>
        )}
      </span>
      <span>{fallbackLabel || tool.name}</span>
      <ExternalLink
        size={11}
        aria-hidden
        className="text-muted-foreground group-hover:text-foreground"
      />
    </a>
  );
}

// ---------- inline skill card ---------------------------------------

function SkillInlineCard({
  id,
  skill,
  fallbackLabel,
}: {
  id: string;
  skill: SkillRef | undefined;
  fallbackLabel?: string;
}) {
  if (!skill) {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 border border-dashed bg-secondary/40 px-2 align-middle text-xs text-muted-foreground">
        <Download size={12} aria-hidden />
        {fallbackLabel || `skill:${id}`}
        <span className="text-[10px] text-muted-foreground/70">?</span>
      </span>
    );
  }
  return (
    <a
      href={`/api/skills/${skill.id}/download`}
      title={skill.filename}
      className="inline-flex items-center gap-2 border-2 border-chalk/30 bg-card px-2.5 py-1 align-middle text-sm font-semibold text-card-foreground no-underline hover:border-chalk/70 hover:bg-accent hover:text-accent-foreground"
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center bg-chalk text-chalk"
        aria-hidden
      >
        <Download size={11} />
      </span>
      <span>{fallbackLabel || skill.name}</span>
      <span className="font-mono text-sm font-medium text-muted-foreground">
        .md
      </span>
    </a>
  );
}
