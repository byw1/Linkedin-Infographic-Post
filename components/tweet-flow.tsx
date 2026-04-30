"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import * as htmlToImage from "html-to-image";
import { jsPDF } from "jspdf";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import {
  DEFAULT_TWEET,
  TWEET_CANVAS,
  TweetPreview,
  type Background,
  type CheckMark,
  type FontScale,
  type TweetData,
} from "@/components/tweet-preview";

// Tweet generator. Supports a single tweet OR a thread (multi-slide
// carousel). Each slide is independently editable but cloning the
// active slide as the "+" template keeps personas consistent across
// a thread without re-typing every field.
//
// Generate iterates the slides, rasterizes each via html-to-image
// at native 1080×1350, posts each to /api/render with format=tweet,
// and shows a batch result panel with per-slide download links.
//
// Persona presets save to localStorage. Cross-device sync would
// need a model — fine to defer until people ask.

// "Styles" key — bumped to v3. The snapshot now stores ONLY the
// persona + visual styling + element-visibility toggles. Per-tweet
// content (body, time, reposted-by, engagement counts) is
// intentionally excluded so loading a style swaps the look without
// touching what the user is writing. v2 data won't load.
const STYLES_KEY = "viral.tweet.styles.v3";

// Explicit shape of a saved style. Mirrors the carryover but is
// kept as a separate type — the carryover is the auto-saved "last
// used"; styles are explicit named saves the admin manages.
interface StyleSnapshot {
  // Persona
  name: string;
  username: string;
  avatarUrl: string | null;
  checkmark: TweetData["checkmark"];
  affiliationLogo: string | null;
  affiliationLabel: string;
  // Visual styling
  background: TweetData["background"];
  backgroundColor: string;
  border: boolean;
  fontScale: TweetData["fontScale"];
  bodyFontSize: number | null;
  // Element visibility toggles
  showBell: boolean;
  showMore: boolean;
  showShare: boolean;
  showTime: boolean;
  showReposted: boolean;
  showReplies: boolean;
  showReposts: boolean;
  showLikes: boolean;
  showBookmarks: boolean;
  showImpressions: boolean;
}

function snapshotStyle(d: TweetData): StyleSnapshot {
  return {
    name: d.name,
    username: d.username,
    avatarUrl: d.avatarUrl,
    checkmark: d.checkmark,
    affiliationLogo: d.affiliationLogo,
    affiliationLabel: d.affiliationLabel,
    background: d.background,
    backgroundColor: d.backgroundColor,
    border: d.border,
    fontScale: d.fontScale,
    bodyFontSize: d.bodyFontSize,
    showBell: d.showBell,
    showMore: d.showMore,
    showShare: d.showShare,
    showTime: d.showTime,
    showReposted: d.showReposted,
    showReplies: d.engagement.showReplies,
    showReposts: d.engagement.showReposts,
    showLikes: d.engagement.showLikes,
    showBookmarks: d.engagement.showBookmarks,
    showImpressions: d.engagement.showImpressions,
  };
}

function applyStyle(base: TweetData, s: StyleSnapshot): TweetData {
  return {
    ...base,
    name: s.name,
    username: s.username,
    avatarUrl: s.avatarUrl,
    checkmark: s.checkmark,
    affiliationLogo: s.affiliationLogo,
    affiliationLabel: s.affiliationLabel,
    background: s.background,
    backgroundColor: s.backgroundColor,
    border: s.border,
    fontScale: s.fontScale,
    bodyFontSize: s.bodyFontSize,
    showBell: s.showBell,
    showMore: s.showMore,
    showShare: s.showShare,
    showTime: s.showTime,
    showReposted: s.showReposted,
    engagement: {
      ...base.engagement,
      showReplies: s.showReplies,
      showReposts: s.showReposts,
      showLikes: s.showLikes,
      showBookmarks: s.showBookmarks,
      showImpressions: s.showImpressions,
    },
  };
}
// Auto-persisted "remember my settings" key. Holds the fields a
// user repeats across sessions: persona + visuals + which
// engagement metrics they like to show. Per-post content (body,
// time, reposted-by, engagement counts) is intentionally NOT
// persisted — those are per-tweet, not per-user.
const CARRYOVER_KEY = "viral.tweet.carryover.v1";

interface CarryoverData {
  name: string;
  username: string;
  avatarUrl: string | null;
  checkmark: TweetData["checkmark"];
  affiliationLogo: string | null;
  affiliationLabel: string;
  showBell: boolean;
  showMore: boolean;
  showShare: boolean;
  // Time + reposted-by visibility — the input rows that surface
  // below the body are gated on these. Their content (timeAgo,
  // repostedBy) stays per-tweet and isn't persisted.
  showTime: boolean;
  showReposted: boolean;
  background: TweetData["background"];
  backgroundColor: string;
  border: boolean;
  fontScale: TweetData["fontScale"];
  bodyFontSize: number | null;
  // Engagement *visibility* persists; the actual numbers don't.
  showReplies: boolean;
  showReposts: boolean;
  showLikes: boolean;
  showBookmarks: boolean;
  showImpressions: boolean;
}

function extractCarryover(d: TweetData): CarryoverData {
  return {
    name: d.name,
    username: d.username,
    avatarUrl: d.avatarUrl,
    checkmark: d.checkmark,
    affiliationLogo: d.affiliationLogo,
    affiliationLabel: d.affiliationLabel,
    showBell: d.showBell,
    showMore: d.showMore,
    showShare: d.showShare,
    showTime: d.showTime,
    showReposted: d.showReposted,
    background: d.background,
    backgroundColor: d.backgroundColor,
    border: d.border,
    fontScale: d.fontScale,
    bodyFontSize: d.bodyFontSize,
    showReplies: d.engagement.showReplies,
    showReposts: d.engagement.showReposts,
    showLikes: d.engagement.showLikes,
    showBookmarks: d.engagement.showBookmarks,
    showImpressions: d.engagement.showImpressions,
  };
}

function applyCarryover(base: TweetData, c: CarryoverData): TweetData {
  return {
    ...base,
    name: c.name,
    username: c.username,
    avatarUrl: c.avatarUrl,
    checkmark: c.checkmark,
    affiliationLogo: c.affiliationLogo,
    affiliationLabel: c.affiliationLabel,
    showBell: c.showBell,
    showMore: c.showMore,
    showShare: c.showShare,
    showTime: c.showTime,
    showReposted: c.showReposted,
    background: c.background,
    backgroundColor: c.backgroundColor,
    border: c.border,
    fontScale: c.fontScale,
    bodyFontSize: c.bodyFontSize,
    engagement: {
      ...base.engagement,
      showReplies: c.showReplies,
      showReposts: c.showReposts,
      showLikes: c.showLikes,
      showBookmarks: c.showBookmarks,
      showImpressions: c.showImpressions,
    },
  };
}

// Pack an ordered list of PNG blobs into a single multi-page PDF.
// Each page sized to the native tweet canvas (1080×1350 px) so
// the image lays in 1:1 — LinkedIn's document carousel uploader
// reads any aspect ratio fine. Returns the assembled PDF as a
// Blob ready to POST through the existing render endpoint.
async function blobsToPdf(blobs: Blob[]): Promise<Blob> {
  const pdf = new jsPDF({
    unit: "px",
    format: [TWEET_CANVAS.width, TWEET_CANVAS.height],
    orientation: "portrait",
    // hotfixes mode disables the 0.75x scaling jsPDF applies to
    // px units by default, so page dimensions match the canvas
    // exactly — no need to convert mm/in.
    hotfixes: ["px_scaling"],
  });
  for (let i = 0; i < blobs.length; i++) {
    if (i > 0) pdf.addPage([TWEET_CANVAS.width, TWEET_CANVAS.height], "portrait");
    const dataUrl = await blobToDataUrl(blobs[i]);
    pdf.addImage(
      dataUrl,
      "PNG",
      0,
      0,
      TWEET_CANVAS.width,
      TWEET_CANVAS.height,
    );
  }
  return pdf.output("blob");
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("FileReader failed"));
    r.readAsDataURL(blob);
  });
}

// The native <input type="color"> only accepts 7-char "#rrggbb"
// strings. The user's hex field accepts anything they type, so
// coerce here — fall back to a safe black if it doesn't parse.
function normalizeHex(input: string): string {
  const trimmed = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#000000";
}

function loadCarryover(): CarryoverData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CARRYOVER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CarryoverData;
  } catch {
    return null;
  }
}

interface SlideRow {
  id: string;
  data: TweetData;
}

interface StyleRow {
  id: string;
  label: string;
  // Persona + visual styling + element-visibility toggles only.
  // Per-tweet content (body, timeAgo, repostedBy, engagement
  // counts) deliberately excluded — loading a style swaps the
  // look without touching the post the user is writing.
  data: StyleSnapshot;
}

interface BatchResult {
  slideId: string;
  renderId: string;
  pngUrl: string;
}

interface Props {
  storageReady: boolean;
}

type Stage = "edit" | "result";

export function TweetFlow({ storageReady }: Props) {
  const [slides, setSlides] = useState<SlideRow[]>(() => {
    // Hydrate the first slide from the auto-persisted carryover
    // ("remember my settings"). Per-tweet content stays default —
    // we don't want a stale body/time loaded from last session.
    const carryover = loadCarryover();
    const data = carryover
      ? applyCarryover(DEFAULT_TWEET, carryover)
      : { ...DEFAULT_TWEET };
    return [{ id: crypto.randomUUID(), data }];
  });
  const [activeId, setActiveId] = useState(() => slides[0].id);
  const [presets, setPresets] = useState<StyleRow[]>([]);
  const [stage, setStage] = useState<Stage>("edit");
  // Multi-slide threads can either ship as separate PNGs (one
  // Render row per slide) or as a single combined PDF — the
  // canonical LinkedIn document-carousel format.
  const [combineAsPdf, setCombineAsPdf] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

  const activeSlide = slides.find((s) => s.id === activeId) ?? slides[0];
  const isThread = slides.length > 1;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STYLES_KEY);
      if (raw) setPresets(JSON.parse(raw) as StyleRow[]);
    } catch {
      // Corrupt JSON just means no presets — silent skip.
    }
  }, []);

  // Auto-persist the active slide's carryover fields so the next
  // visit lands on the same persona / visuals / show-flags. We
  // serialize JSON.stringify(carryover) as the dep so the effect
  // only writes when those specific fields actually change — not
  // on every body keystroke.
  const carryover = extractCarryover(activeSlide.data);
  const carryoverKey = JSON.stringify(carryover);
  useEffect(() => {
    try {
      window.localStorage.setItem(CARRYOVER_KEY, carryoverKey);
    } catch {
      // Storage full or disabled — skip silently. The session
      // still works; just won't restore on next visit.
    }
  }, [carryoverKey]);

  function persistPresets(next: StyleRow[]) {
    setPresets(next);
    localStorage.setItem(STYLES_KEY, JSON.stringify(next));
  }

  // Update the active slide's data with a partial patch.
  function patchActive(patch: Partial<TweetData>) {
    setSlides((prev) =>
      prev.map((s) =>
        s.id === activeId ? { ...s, data: { ...s.data, ...patch } } : s,
      ),
    );
  }

  function patchEngagement(patch: Partial<TweetData["engagement"]>) {
    setSlides((prev) =>
      prev.map((s) =>
        s.id === activeId
          ? {
              ...s,
              data: { ...s.data, engagement: { ...s.data.engagement, ...patch } },
            }
          : s,
      ),
    );
  }

  function addSlide() {
    // Clone visuals + persona from the active slide so a thread
    // stays cohesive — only body/engagement/time/reposted reset.
    const src = activeSlide.data;
    const fresh: TweetData = {
      ...src,
      body: "",
      timeAgo: "",
      repostedBy: "",
      engagement: {
        ...src.engagement,
        replies: 0,
        reposts: 0,
        likes: 0,
        bookmarks: 0,
        impressions: 0,
      },
    };
    const id = crypto.randomUUID();
    setSlides((prev) => [...prev, { id, data: fresh }]);
    setActiveId(id);
  }

  function removeSlide(id: string) {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) {
      const remaining = slides.filter((s) => s.id !== id);
      setActiveId(remaining[0].id);
    }
  }

  function moveSlide(id: string, dir: -1 | 1) {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function saveStyle() {
    const label = prompt("Style name?", activeSlide.data.name)?.trim();
    if (!label) return;
    const id = crypto.randomUUID();
    // Snapshot is persona + visual styling + element-visibility
    // toggles. Per-tweet content (body, time, reposted-by,
    // engagement counts) stays out so loading a style swaps the
    // look without trampling the post in progress.
    const data = snapshotStyle(activeSlide.data);
    persistPresets([...presets, { id, label, data }]);
  }

  function loadStyle(p: StyleRow) {
    setSlides((prev) =>
      prev.map((s) =>
        s.id === activeId
          ? { ...s, data: applyStyle(s.data, p.data) }
          : s,
      ),
    );
  }

  function deleteStyle(id: string) {
    persistPresets(presets.filter((p) => p.id !== id));
  }

  function onAvatarFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patchActive({ avatarUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  function onAffiliationFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patchActive({ affiliationLogo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  // Plausible engagement numbers anchored to a random impressions
  // count. Ratios pulled from typical viral-tweet posts so the
  // result reads believable instead of obviously synthetic.
  function randomize() {
    const impressions = 1000 + Math.floor(Math.random() * 199_000);
    const likes = Math.floor(impressions * (0.005 + Math.random() * 0.025));
    const replies = Math.floor(likes * (0.05 + Math.random() * 0.2));
    const reposts = Math.floor(likes * (0.005 + Math.random() * 0.05));
    const bookmarks = Math.floor(likes * (0.02 + Math.random() * 0.1));
    patchEngagement({ impressions, likes, replies, reposts, bookmarks });
  }

  // Capture the live preview node at native resolution. The preview
  // always reflects the active slide; for thread mode we re-render
  // the preview between captures (await a microtask to let React
  // commit the new active slide).
  async function captureCurrent(): Promise<Blob> {
    const node = previewRef.current;
    if (!node) throw new Error("Preview not ready.");
    const slide = slides.find((s) => s.id === activeId) ?? slides[0];
    const transparent = slide.data.background === "transparent";
    const blob = await htmlToImage.toBlob(node, {
      width: TWEET_CANVAS.width,
      height: TWEET_CANVAS.height,
      pixelRatio: 1,
      // Match the canvas — transparent mode wants alpha; everything
      // else wants the explicit dark base so any transparent pixels
      // in the avatar don't punch through to the page.
      backgroundColor: transparent ? undefined : "#000000",
      cacheBust: true,
    });
    if (!blob) throw new Error("Capture returned no bytes.");
    return blob;
  }

  async function uploadOne(blob: Blob, slide: SlideRow, index: number): Promise<BatchResult> {
    const tag = isThread ? ` ${index + 1}/${slides.length}` : "";
    const filename =
      `Tweet${tag} — ${slide.data.name || slide.data.username}`.slice(0, 80);
    const form = new FormData();
    form.append("file", blob, "tweet.png");
    form.append("filename", filename);
    form.append("format", "tweet");
    const res = await fetch("/api/render", { method: "POST", body: form });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        typeof errBody.error === "string" ? errBody.error : "Save failed.",
      );
    }
    const out = await res.json();
    return { slideId: slide.id, renderId: out.render_id, pngUrl: out.png_url };
  }

  // Capture every slide's PNG in sequence — switches the live
  // preview to each slide, waits for the DOM to commit, then
  // grabs the bytes. Used by both the per-slide upload path and
  // the PDF assembly path.
  async function captureAllSlideBlobs(): Promise<Blob[]> {
    const blobs: Blob[] = [];
    for (const slide of slides) {
      setActiveId(slide.id);
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      blobs.push(await captureCurrent());
    }
    return blobs;
  }

  async function generate() {
    setError(null);
    if (!storageReady) {
      setError("Storage isn't configured — set it in /admin/health first.");
      return;
    }

    startTransition(async () => {
      try {
        const blobs = await captureAllSlideBlobs();

        // Multi-slide thread + combineAsPdf → ship one PDF as a
        // single Render row with format="carousel" (the existing
        // LinkedIn document-carousel format). One result, one
        // file the user can upload to LinkedIn directly.
        if (slides.length > 1 && combineAsPdf) {
          const pdfBlob = await blobsToPdf(blobs);
          const filename = `Tweet thread (${slides.length}) — ${slides[0].data.name || slides[0].data.username}`.slice(
            0,
            80,
          );
          const form = new FormData();
          form.append("file", pdfBlob, "thread.pdf");
          form.append("filename", filename);
          form.append("format", "carousel");
          const res = await fetch("/api/render", { method: "POST", body: form });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(
              typeof errBody.error === "string"
                ? errBody.error
                : "Save failed.",
            );
          }
          const out = await res.json();
          setResults([
            {
              slideId: slides[0].id,
              renderId: out.render_id,
              pngUrl: out.png_url,
            },
          ]);
          setStage("result");
          return;
        }

        // Per-slide PNGs path — upload each blob to its own
        // Render row, return the batch.
        const out: BatchResult[] = [];
        for (let i = 0; i < slides.length; i++) {
          const result = await uploadOne(blobs[i], slides[i], i);
          out.push(result);
        }
        setResults(out);
        setStage("result");
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  if (stage === "result") {
    return (
      <BatchResultView
        results={results}
        slides={slides}
        onReset={() => {
          setStage("edit");
          setResults([]);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Form
          data={activeSlide.data}
          patch={patchActive}
          patchEngagement={patchEngagement}
          styles={presets}
          saveStyle={saveStyle}
          loadStyle={loadStyle}
          deleteStyle={deleteStyle}
          randomize={randomize}
          onAvatarFile={onAvatarFile}
          onAffiliationFile={onAffiliationFile}
          onGenerate={generate}
          pending={pending}
          error={error}
          slideCount={slides.length}
          combineAsPdf={combineAsPdf}
          setCombineAsPdf={setCombineAsPdf}
        />

        <div className="space-y-3">
          <PreviewSurface previewRef={previewRef} data={activeSlide.data} />
          <SlidesStrip
            slides={slides}
            activeId={activeId}
            onSelect={setActiveId}
            onAdd={addSlide}
            onRemove={removeSlide}
            onMove={moveSlide}
          />
        </div>
      </div>
    </div>
  );
}

function Form({
  data,
  patch,
  patchEngagement,
  styles,
  saveStyle,
  loadStyle,
  deleteStyle,
  randomize,
  onAvatarFile,
  onAffiliationFile,
  onGenerate,
  pending,
  error,
  slideCount,
  combineAsPdf,
  setCombineAsPdf,
}: {
  data: TweetData;
  patch: (p: Partial<TweetData>) => void;
  patchEngagement: (p: Partial<TweetData["engagement"]>) => void;
  styles: StyleRow[];
  saveStyle: () => void;
  loadStyle: (p: StyleRow) => void;
  deleteStyle: (id: string) => void;
  randomize: () => void;
  onAvatarFile: (file: File | null) => void;
  onAffiliationFile: (file: File | null) => void;
  onGenerate: () => void;
  pending: boolean;
  error: string | null;
  slideCount: number;
  combineAsPdf: boolean;
  setCombineAsPdf: (v: boolean) => void;
}) {
  const e = data.engagement;
  return (
    <div className="space-y-3 rounded-md border bg-card p-4 text-card-foreground">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Tweet · slide {slideCount > 1 ? "(thread)" : ""}
      </div>

      {/* Visuals — single section that holds persona + styling +
        * the show/hide gear popover. Save Style snapshots
        * everything in here (persona + visual styling + element
        * toggles), so loading a saved style swaps the whole look
        * cleanly. */}
      <Section
        title="Visuals"
        actions={
          <GearPopover>
            <ToggleChip
              label="Notification icon"
              checked={data.showBell}
              onChange={(v) => patch({ showBell: v })}
            />
            <ToggleChip
              label="More (⋯) menu"
              checked={data.showMore}
              onChange={(v) => patch({ showMore: v })}
            />
            <ToggleChip
              label="Share icon"
              checked={data.showShare}
              onChange={(v) => patch({ showShare: v })}
            />
            <ToggleChip
              label="Card border"
              checked={data.border}
              onChange={(v) => patch({ border: v })}
            />
            <div className="my-1 border-t" />
            <ToggleChip
              label="Time ago"
              checked={data.showTime}
              onChange={(v) => patch({ showTime: v })}
            />
            <ToggleChip
              label="Reposted by"
              checked={data.showReposted}
              onChange={(v) => patch({ showReposted: v })}
            />
            <div className="my-1 border-t" />
            <ToggleChip
              label="Replies"
              checked={data.engagement.showReplies}
              onChange={(v) => patchEngagement({ showReplies: v })}
            />
            <ToggleChip
              label="Reposts"
              checked={data.engagement.showReposts}
              onChange={(v) => patchEngagement({ showReposts: v })}
            />
            <ToggleChip
              label="Likes"
              checked={data.engagement.showLikes}
              onChange={(v) => patchEngagement({ showLikes: v })}
            />
            <ToggleChip
              label="Bookmarks"
              checked={data.engagement.showBookmarks}
              onChange={(v) => patchEngagement({ showBookmarks: v })}
            />
            <ToggleChip
              label="Impressions"
              checked={data.engagement.showImpressions}
              onChange={(v) => patchEngagement({ showImpressions: v })}
            />
          </GearPopover>
        }
      >
        {/* Persona — name / username, avatar + verified badge,
          * optional affiliation. Lives inside Visuals so a saved
          * style round-trips persona + style as one bundle. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Display name"
            value={data.name}
            onChange={(v) => patch({ name: v })}
            placeholder="autumnkyoko"
          />
          <Field
            label="Username"
            value={data.username}
            onChange={(v) => patch({ username: v.replace(/^@/, "") })}
            placeholder="akcushman"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FileField
            label="Avatar"
            hasFile={Boolean(data.avatarUrl)}
            onFile={onAvatarFile}
            onClear={() => patch({ avatarUrl: null })}
          />
          <label className="block text-sm">
            <span className="block text-[11px] text-muted-foreground">Verified badge</span>
            <select
              value={data.checkmark}
              onChange={(ev) => patch({ checkmark: ev.target.value as CheckMark })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="none">None</option>
              <option value="blue">Blue · individual</option>
              <option value="gold">Gold · organization</option>
              <option value="gray">Gray · government / affiliated</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FileField
            label="Affiliation logo (optional)"
            hint="Small square logo right of the checkmark."
            hasFile={Boolean(data.affiliationLogo)}
            onFile={onAffiliationFile}
            onClear={() => patch({ affiliationLogo: null })}
          />
          <Field
            label="Affiliation label (alt)"
            value={data.affiliationLabel}
            onChange={(v) => patch({ affiliationLabel: v })}
            placeholder="Acme Inc."
          />
        </div>

        {/* Style strip — save / load / delete saved styles. Saving
          * captures persona + every visual field + every element-
          * visibility toggle, so jumping between named "looks"
          * doesn't disturb the body the user is typing. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveStyle}
            className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] hover:bg-secondary"
            title="Save persona + every visual setting + element-visibility toggles (excludes body text + engagement counts + time + reposted-by)"
          >
            + Save current style
          </button>
          {styles.length > 0 && (
            <span className="text-[11px] text-muted-foreground">styles:</span>
          )}
          {styles.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full border bg-secondary/50 pl-2.5 pr-1 text-[11px]"
            >
              <button
                type="button"
                onClick={() => loadStyle(p)}
                className="py-0.5 hover:text-foreground"
              >
                {p.label}
              </button>
              <button
                type="button"
                onClick={() => deleteStyle(p.id)}
                aria-label={`Delete style ${p.label}`}
                className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="border-t pt-3" />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block text-[11px] text-muted-foreground">Background</span>
            <select
              value={data.background}
              onChange={(ev) => patch({ background: ev.target.value as Background })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="gradient">Gradient (brand)</option>
              <option value="black">Solid black</option>
              <option value="white">Solid white (light mode)</option>
              <option value="custom">Custom color…</option>
              <option value="transparent">Transparent</option>
            </select>
            {data.background === "custom" && (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={normalizeHex(data.backgroundColor)}
                  onChange={(ev) => patch({ backgroundColor: ev.target.value })}
                  className="h-7 w-10 cursor-pointer rounded border bg-background"
                />
                <input
                  type="text"
                  value={data.backgroundColor}
                  onChange={(ev) => patch({ backgroundColor: ev.target.value })}
                  placeholder="#0a0a0f"
                  className="h-7 flex-1 rounded-md border bg-background px-2 font-mono text-xs"
                />
              </div>
            )}
          </label>
          <label className="block text-sm">
            <span className="block text-[11px] text-muted-foreground">Font scale (overall)</span>
            <select
              value={data.fontScale}
              onChange={(ev) => patch({ fontScale: ev.target.value as FontScale })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="sm">Small</option>
              <option value="md">Default</option>
              <option value="lg">Large</option>
            </select>
          </label>
        </div>

        {/* Body font-size override — for the "huge text" viral
          * post pattern. Toggle on to take direct control of the
          * body's px size; off lets it inherit from font scale. */}
        <BodySizeOverride
          value={data.bodyFontSize}
          onChange={(v) => patch({ bodyFontSize: v })}
        />
      </Section>

      {/* Body lives at the bottom — it's the focus, treat it as
        * the primary writing surface rather than buried in form
        * fields. No collapsing here on purpose. */}
      <fieldset className="space-y-2">
        <legend className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Body
        </legend>
        <textarea
          value={data.body}
          onChange={(ev) => patch({ body: ev.target.value })}
          rows={5}
          maxLength={4000}
          placeholder="Type the tweet text. Multi-line + line breaks work."
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </fieldset>

      {/* Per-tweet inputs — only the rows for elements actually
        * enabled in the gear popover render. Time + reposted-by
        * sit above the engagement values, mirroring the order they
        * appear on the rendered tweet. */}
      <PerTweetInputs
        data={data}
        patch={patch}
        patchEngagement={patchEngagement}
        randomize={randomize}
      />

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onGenerate}
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Rendering..."
            : slideCount > 1
              ? combineAsPdf
                ? "Generate PDF"
                : `Generate ${slideCount} PNGs`
              : "Generate PNG"}
        </button>
        <span className="text-[11px] text-muted-foreground">
          {TWEET_CANVAS.width}×{TWEET_CANVAS.height} · LinkedIn portrait
        </span>
      </div>

      {/* PDF combine — only meaningful when there's >1 slide. The
        * default is on because most users threading multiple
        * tweets actually want a single LinkedIn carousel doc to
        * upload, not a folder of separate PNGs. */}
      {slideCount > 1 && (
        <label className="flex items-start gap-2 rounded-md border bg-background/40 p-2.5 text-xs">
          <input
            type="checkbox"
            checked={combineAsPdf}
            onChange={(ev) => setCombineAsPdf(ev.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium">Combine into a single PDF</span>
            <span className="block text-[10px] text-muted-foreground">
              LinkedIn document carousel format — one upload, one post.
              Uncheck to ship each slide as its own PNG instead.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

// Per-tweet content inputs that surface below the body when their
// corresponding element is enabled in the gear popover. Time +
// reposted-by are simple text inputs; engagement values are number
// inputs paired with a Randomize button at the top of the metric
// block. Renders nothing when nothing is enabled.
function PerTweetInputs({
  data,
  patch,
  patchEngagement,
  randomize,
}: {
  data: TweetData;
  patch: (p: Partial<TweetData>) => void;
  patchEngagement: (p: Partial<TweetData["engagement"]>) => void;
  randomize: () => void;
}) {
  const e = data.engagement;
  const enabledMetrics: Array<{
    key: keyof TweetData["engagement"];
    label: string;
    show: boolean;
    value: number | null;
  }> = [
    { key: "replies", label: "Replies", show: e.showReplies, value: e.replies },
    { key: "reposts", label: "Reposts", show: e.showReposts, value: e.reposts },
    { key: "likes", label: "Likes", show: e.showLikes, value: e.likes },
    {
      key: "bookmarks",
      label: "Bookmarks",
      show: e.showBookmarks,
      value: e.bookmarks,
    },
    {
      key: "impressions",
      label: "Impressions",
      show: e.showImpressions,
      value: e.impressions,
    },
  ];
  const visibleMetrics = enabledMetrics.filter((m) => m.show);
  const showMetricsBlock = visibleMetrics.length > 0;
  const showAnything = data.showTime || data.showReposted || showMetricsBlock;

  if (!showAnything) {
    return (
      <p className="text-[11px] italic text-muted-foreground">
        Nothing else to fill in. Toggle Time / Reposted by / engagement
        metrics on in the Visuals gear if you want to surface them.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {(data.showTime || data.showReposted) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.showTime && (
            <Field
              label="Time ago"
              value={data.timeAgo}
              onChange={(v) => patch({ timeAgo: v })}
              placeholder="10h, 3m, Apr 30"
            />
          )}
          {data.showReposted && (
            <Field
              label="Reposted by"
              value={data.repostedBy}
              onChange={(v) => patch({ repostedBy: v })}
              placeholder="Bob"
            />
          )}
        </div>
      )}

      {showMetricsBlock && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Engagement
            </span>
            <button
              type="button"
              onClick={randomize}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Randomize
            </button>
          </div>
          {visibleMetrics.map((m) => (
            <MetricValueInput
              key={m.key}
              label={m.label}
              value={m.value}
              onChange={(v) => patchEngagement({ [m.key]: v } as Partial<TweetData["engagement"]>)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Number input for an engagement metric. Toggle-free (visibility
// lives in the gear popover now); cleaner row than the old
// MetricRow which paired a checkbox with the value.
function MetricValueInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-20 text-xs text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value === null ? "" : String(value)}
        onChange={(ev) => {
          const cleaned = ev.target.value.replace(/[, ]/g, "").trim();
          if (!cleaned) {
            onChange(null);
            return;
          }
          const n = Number(cleaned);
          if (Number.isFinite(n) && n >= 0) onChange(Math.floor(n));
        }}
        placeholder="0"
        className="h-8 flex-1 rounded-md border bg-background px-2 text-xs tabular-nums"
      />
    </label>
  );
}

// Collapsible section wrapper. Click the title chevron to fold the
// body out of view; an optional `actions` slot floats to the right
// of the header for things like "randomize" or the gear popover.
function Section({
  title,
  children,
  defaultOpen = true,
  actions,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <fieldset className="space-y-3 rounded-md border border-input/40 bg-background/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
        </button>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {open && <div className="space-y-3">{children}</div>}
    </fieldset>
  );
}

// Click-toggle gear popover. Closes on outside click via a document
// mousedown handler. Used in the Visuals section to host the on/off
// toggles for X UI elements without bloating the main editor.
function GearPopover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] hover:bg-secondary"
        title="Show / hide UI elements"
      >
        <Settings2 size={12} />
        Elements
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-md border bg-card p-3 text-card-foreground shadow-lg">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            Show / hide
          </div>
          <div className="flex flex-col gap-1.5">{children}</div>
        </div>
      )}
    </div>
  );
}

// Optional override for the body text size in pixels. Off → body
// inherits from the overall font scale. On → user takes control,
// 12-300px range covers everything from "tiny clarification post"
// to "BIG TEXT VIRAL HOOK".
function BodySizeOverride({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const enabled = value !== null;
  const px = value ?? 28;
  return (
    <label className="block text-sm">
      <span className="block text-[11px] text-muted-foreground">
        Body size override
      </span>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(ev) => onChange(ev.target.checked ? px : null)}
          className="h-4 w-4"
          aria-label="Override body size"
        />
        <input
          type="range"
          min={12}
          max={300}
          value={px}
          disabled={!enabled}
          onChange={(ev) => onChange(Number(ev.target.value))}
          className="h-2 flex-1 disabled:opacity-50"
        />
        <input
          type="number"
          min={12}
          max={300}
          value={px}
          disabled={!enabled}
          onChange={(ev) => {
            const n = Number(ev.target.value);
            if (Number.isFinite(n)) onChange(Math.max(12, Math.min(300, n)));
          }}
          className="h-8 w-16 rounded-md border bg-background px-2 text-xs tabular-nums disabled:opacity-50"
        />
        <span className="text-[10px] text-muted-foreground">px</span>
      </div>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
      />
    </label>
  );
}

function FileField({
  label,
  hint,
  hasFile,
  onFile,
  onClear,
}: {
  label: string;
  hint?: string;
  hasFile: boolean;
  onFile: (file: File | null) => void;
  onClear: () => void;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <input
        type="file"
        accept="image/*"
        onChange={(ev) => onFile(ev.target.files?.[0] ?? null)}
        className="block w-full text-xs file:mr-2 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        {hint && <span className="text-[10px] text-muted-foreground/80">{hint}</span>}
        {hasFile && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
          >
            Remove
          </button>
        )}
      </div>
    </label>
  );
}

function ToggleChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(ev) => onChange(ev.target.checked)}
        className="h-4 w-4"
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </label>
  );
}

function PreviewSurface({
  previewRef,
  data,
}: {
  previewRef: React.RefObject<HTMLDivElement>;
  data: TweetData;
}) {
  // The captured TweetPreview stays at native 1080×1350 — html-to-
  // image needs the un-transformed element to grab the right pixel
  // dimensions. Visual shrink lives on the wrapper.
  const SCALE = 0.4;
  const visibleW = useMemo(() => TWEET_CANVAS.width * SCALE, []);
  const visibleH = useMemo(() => TWEET_CANVAS.height * SCALE, []);

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Preview · {TWEET_CANVAS.width}×{TWEET_CANVAS.height}
      </div>
      <div
        className="overflow-hidden rounded-md border bg-black/40"
        style={{ width: visibleW, height: visibleH }}
      >
        <div
          style={{
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
            width: TWEET_CANVAS.width,
            height: TWEET_CANVAS.height,
          }}
        >
          <TweetPreview ref={previewRef} data={data} />
        </div>
      </div>
    </div>
  );
}

function SlidesStrip({
  slides,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  onMove,
}: {
  slides: SlideRow[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Slides {slides.length > 1 && `(thread of ${slides.length})`}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {slides.map((s, i) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-0.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "hover:bg-secondary"
              }`}
            >
              <button type="button" onClick={() => onSelect(s.id)} className="px-1">
                Slide {i + 1}
              </button>
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => onMove(s.id, -1)}
                    disabled={i === 0}
                    title="Move left"
                    className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(s.id, 1)}
                    disabled={i === slides.length - 1}
                    title="Move right"
                    className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove slide ${i + 1}?`)) onRemove(s.id);
                    }}
                    title="Remove slide"
                    className="px-1 text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-8 items-center rounded-md border border-dashed px-3 text-xs hover:bg-secondary"
        >
          + Add slide
        </button>
      </div>
    </div>
  );
}

function BatchResultView({
  results,
  slides,
  onReset,
}: {
  results: BatchResult[];
  slides: SlideRow[];
  onReset: () => void;
}) {
  // Map slide id → ordinal so the result panel can show "Slide 3"
  // alongside the matching PNG even though results array order =
  // slides array order.
  const ordinalById = new Map(slides.map((s, i) => [s.id, i + 1]));
  const isThread = results.length > 1;
  // Single result with a .pdf URL → the PDF combine path. Render
  // a download tile rather than an <img> since browsers won't
  // inline a PDF blob URL like an image.
  const isPdfBundle =
    results.length === 1 && results[0].pngUrl.toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 text-sm">
        Done.{" "}
        {isPdfBundle
          ? `Thread of ${slides.length} tweets bundled into one PDF — ready to upload as a LinkedIn document carousel.`
          : `${results.length} ${results.length === 1 ? "tweet" : "tweets"} rendered.`}{" "}
        {isThread && !isPdfBundle && (
          <span className="text-muted-foreground">
            Each slide saved as its own post in your archive — open them on
            /posts to track or download.
          </span>
        )}
      </div>

      {isPdfBundle ? (
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-primary">
              {slides.length}-slide PDF · LinkedIn carousel
            </span>
            <a
              href={results[0].pngUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold hover:underline"
            >
              Open PDF
            </a>
            <a
              href={results[0].pngUrl}
              download
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Download
            </a>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <div
              key={r.slideId}
              className="overflow-hidden rounded-lg border bg-card text-card-foreground"
            >
              <div className="bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.pngUrl}
                  alt={`Tweet slide ${ordinalById.get(r.slideId)}`}
                  className="block h-auto w-full"
                />
              </div>
              <div className="flex items-center justify-between gap-2 p-3 text-xs">
                <span className="font-medium">
                  Slide {ordinalById.get(r.slideId)}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={r.pngUrl}
                    download
                    className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                  >
                    Download
                  </a>
                  <a
                    href={r.pngUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] hover:bg-secondary"
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Edit again
        </button>
        <Link
          href="/posts"
          className="inline-flex h-9 items-center rounded-md border px-4 text-xs hover:bg-secondary"
        >
          Open posts archive
        </Link>
      </div>
    </div>
  );
}
