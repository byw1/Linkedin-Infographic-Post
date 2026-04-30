"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildAliasBridge,
  ensureFontImports,
} from "@/lib/theme-fonts";
import { parseCssTokens } from "@/lib/accent-rewrite";
import type { ResolvedEntity } from "@/types/entity";
import type { CarouselSlide } from "@/components/carousel-upload-dropzone";

interface RailProps {
  slides: CarouselSlide[];
  activeIndex: number;
  entities: ResolvedEntity[];
  themeCss: string | null;
  onPick: (index: number) => void;
}

// Vertical thumbnail rail for the carousel editor. Each thumb is a
// scaled-down sandboxed iframe of the slide HTML — same layout the
// big preview uses, just rendered at 13% scale and with scripts
// blocked so seven Chart.js loads don't all fire on first paint.
// Active slide gets a primary-colored ring; unresolved entity
// counts surface as a small amber badge so flipping to "where do I
// have unresolved logos?" is one glance.
export function SlideRail({
  slides,
  activeIndex,
  entities,
  themeCss,
  onPick,
}: RailProps) {
  const unresolvedSlugs = new Set(
    entities.filter((e) => !e.resolved).map((e) => e.slug),
  );

  return (
    <nav
      aria-label="Slides"
      className="space-y-2 overflow-y-auto pr-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start"
    >
      {slides.map((slide, i) => {
        const unresolvedCount = countUnresolvedInSlide(
          slide.html,
          unresolvedSlugs,
        );
        return (
          <SlideThumb
            key={slide.filename + i}
            html={slide.html}
            entities={entities}
            themeCss={themeCss}
            isActive={i === activeIndex}
            index={i}
            filename={slide.filename}
            unresolvedCount={unresolvedCount}
            onClick={() => onPick(i)}
          />
        );
      })}
    </nav>
  );
}

interface ThumbProps {
  html: string;
  entities: ResolvedEntity[];
  themeCss: string | null;
  isActive: boolean;
  index: number;
  filename: string;
  unresolvedCount: number;
  onClick: () => void;
}

const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1350;
const THUMB_WIDTH = 140;
const SCALE = THUMB_WIDTH / SLIDE_WIDTH; // 0.1296…
const THUMB_HEIGHT = SLIDE_HEIGHT * SCALE; // 175

function SlideThumb({
  html,
  entities,
  themeCss,
  isActive,
  index,
  filename,
  unresolvedCount,
  onClick,
}: ThumbProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Track iframe load — same race as the SampleSlide preview where
  // the initial about:blank is "complete" but isn't the right
  // document. Wait for the actual srcDoc load before mutating.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => setLoaded(true);
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, []);

  // Inject the layout clamp (so .slide-style content fills the
  // thumbnail), the theme tokens (so colors/fonts match the live
  // editor), and the resolved-logo swap (so green placeholders
  // show as real logos when entities resolve). Re-runs on theme +
  // entities changes so flipping a logo updates every thumbnail
  // without re-mounting iframes.
  useEffect(() => {
    if (!loaded) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    // Clear any prior viral-injected nodes so re-runs stay clean.
    doc
      .querySelectorAll("[data-viral-thumb]")
      .forEach((el) => el.remove());

    const head = doc.head ?? doc.documentElement;
    const clamp = doc.createElement("style");
    clamp.setAttribute("data-viral-thumb", "");
    clamp.textContent = `html,body{margin:0!important;padding:0!important}body{width:${SLIDE_WIDTH}px!important;height:${SLIDE_HEIGHT}px!important;overflow:hidden!important}`;
    head.appendChild(clamp);

    if (themeCss) {
      const style = doc.createElement("style");
      style.setAttribute("data-viral-thumb", "");
      const tokens = parseCssTokens(themeCss);
      style.textContent = [
        ensureFontImports(themeCss),
        buildAliasBridge(tokens),
      ].join("\n");
      head.appendChild(style);
    }

    // Resolved-entity swap. Same shape as slide-preview's
    // replaceWithImg but stripped down — no interactivity needed
    // here. Targets data-entity divs and replaces with <img>.
    for (const e of entities) {
      if (!e.resolved || !e.logo_url) continue;
      const slug = e.slug;
      doc
        .querySelectorAll<HTMLElement>(`[data-entity="${cssEscape(slug)}"]`)
        .forEach((el) => {
          if (el.tagName === "IMG") {
            (el as HTMLImageElement).src = e.logo_url!;
            return;
          }
          const img = doc.createElement("img");
          img.setAttribute("src", e.logo_url!);
          img.setAttribute("alt", slug);
          img.setAttribute("data-entity", slug);
          if (el.className) img.className = el.className;
          if (el.id) img.id = el.id;
          const inline = el.getAttribute("style") ?? "";
          img.setAttribute("style", buildImgStyle(inline));
          el.replaceWith(img);
        });
    }
  }, [loaded, themeCss, entities]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Slide ${index + 1}: ${filename}`}
      className={`group block w-full text-left transition-colors`}
    >
      <div
        className={`relative overflow-hidden rounded-md border-2 bg-white ${
          isActive
            ? "border-primary"
            : "border-transparent group-hover:border-border"
        }`}
        style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
      >
        <iframe
          ref={iframeRef}
          title={`Thumbnail of ${filename}`}
          srcDoc={html}
          // No allow-scripts: we don't want Chart.js etc. running
          // in seven thumbnails — saves the ~200KB script load per
          // slide and keeps the rail responsive. Charts will look
          // empty in the thumbs, which is a fine tradeoff for
          // navigation. allow-same-origin lets us inject styles
          // from the parent.
          sandbox="allow-same-origin"
          scrolling="no"
          style={{
            width: SLIDE_WIDTH,
            height: SLIDE_HEIGHT,
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
            border: 0,
            // Thumbnail is purely for navigation — kill all pointer
            // events so the iframe doesn't eat clicks meant for the
            // wrapping button.
            pointerEvents: "none",
          }}
        />
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
          {index + 1}
        </span>
        {unresolvedCount > 0 && (
          <span
            className="absolute right-1 top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-medium text-white"
            title={`${unresolvedCount} unresolved logo${unresolvedCount === 1 ? "" : "s"} on this slide`}
          >
            {unresolvedCount}
          </span>
        )}
      </div>
      <div
        className="mt-1 truncate px-1 text-[10px] text-muted-foreground"
        title={filename}
      >
        {filename}
      </div>
    </button>
  );
}

// Count distinct unresolved slugs that appear in this slide's HTML.
// The slug comparison matches the data-entity attribute exactly so
// a slug like `iheart` won't accidentally match `iheartmedia`.
function countUnresolvedInSlide(
  html: string,
  unresolvedSlugs: Set<string>,
): number {
  if (unresolvedSlugs.size === 0) return 0;
  let n = 0;
  for (const slug of unresolvedSlugs) {
    if (html.includes(`data-entity="${slug}"`)) n += 1;
  }
  return n;
}

// Pull the small subset of inline-style props we want to preserve
// when replacing a placeholder div with an <img>. Mirrors the
// slide-preview helper of the same name; duplicated to keep this
// thumbnail file self-contained.
function buildImgStyle(inline: string): string {
  const w = parseStyleValue(inline, "width");
  const h = parseStyleValue(inline, "height");
  const r = parseStyleValue(inline, "border-radius");
  const mb = parseStyleValue(inline, "margin-bottom");
  const fs = parseStyleValue(inline, "flex-shrink");
  return [
    w && `width:${w}`,
    h && `height:${h}`,
    r && `border-radius:${r}`,
    mb && `margin-bottom:${mb}`,
    fs && `flex-shrink:${fs}`,
    "object-fit:cover",
    "background:#fff",
    "display:block",
  ]
    .filter(Boolean)
    .join(";");
}

function parseStyleValue(style: string, prop: string): string | null {
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
  return m ? m[1].trim() : null;
}

function cssEscape(s: string): string {
  return s.replace(/(["\\])/g, "\\$1");
}
