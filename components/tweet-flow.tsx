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

const PRESETS_KEY = "viral.tweet.presets.v1";
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
  background: TweetData["background"];
  border: boolean;
  fontScale: TweetData["fontScale"];
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
    background: d.background,
    border: d.border,
    fontScale: d.fontScale,
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
    background: c.background,
    border: c.border,
    fontScale: c.fontScale,
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

interface PresetRow {
  id: string;
  label: string;
  // Persona-only snapshot. Body / engagement / visuals are local
  // to the slide so loading a preset doesn't blow away the draft.
  data: Pick<
    TweetData,
    | "name"
    | "username"
    | "avatarUrl"
    | "checkmark"
    | "affiliationLogo"
    | "affiliationLabel"
  >;
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
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [stage, setStage] = useState<Stage>("edit");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

  const activeSlide = slides.find((s) => s.id === activeId) ?? slides[0];
  const isThread = slides.length > 1;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (raw) setPresets(JSON.parse(raw) as PresetRow[]);
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

  function persistPresets(next: PresetRow[]) {
    setPresets(next);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
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

  function savePreset() {
    const label = prompt("Preset name?", activeSlide.data.name)?.trim();
    if (!label) return;
    const id = crypto.randomUUID();
    const d = activeSlide.data;
    persistPresets([
      ...presets,
      {
        id,
        label,
        data: {
          name: d.name,
          username: d.username,
          avatarUrl: d.avatarUrl,
          checkmark: d.checkmark,
          affiliationLogo: d.affiliationLogo,
          affiliationLabel: d.affiliationLabel,
        },
      },
    ]);
  }

  function loadPreset(p: PresetRow) {
    patchActive({
      name: p.data.name,
      username: p.data.username,
      avatarUrl: p.data.avatarUrl,
      checkmark: p.data.checkmark,
      affiliationLogo: p.data.affiliationLogo,
      affiliationLabel: p.data.affiliationLabel,
    });
  }

  function deletePreset(id: string) {
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

  async function generate() {
    setError(null);
    if (!storageReady) {
      setError("Storage isn't configured — set it in /admin/health first.");
      return;
    }

    startTransition(async () => {
      try {
        const out: BatchResult[] = [];
        for (let i = 0; i < slides.length; i++) {
          const slide = slides[i];
          // Switch the live preview to this slide. React batches
          // state updates inside transitions, so wait two animation
          // frames before capturing — long enough for the DOM to
          // commit the new active slide.
          setActiveId(slide.id);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const blob = await captureCurrent();
          const result = await uploadOne(blob, slide, i);
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
          presets={presets}
          savePreset={savePreset}
          loadPreset={loadPreset}
          deletePreset={deletePreset}
          randomize={randomize}
          onAvatarFile={onAvatarFile}
          onAffiliationFile={onAffiliationFile}
          onGenerate={generate}
          pending={pending}
          error={error}
          slideCount={slides.length}
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
  presets,
  savePreset,
  loadPreset,
  deletePreset,
  randomize,
  onAvatarFile,
  onAffiliationFile,
  onGenerate,
  pending,
  error,
  slideCount,
}: {
  data: TweetData;
  patch: (p: Partial<TweetData>) => void;
  patchEngagement: (p: Partial<TweetData["engagement"]>) => void;
  presets: PresetRow[];
  savePreset: () => void;
  loadPreset: (p: PresetRow) => void;
  deletePreset: (id: string) => void;
  randomize: () => void;
  onAvatarFile: (file: File | null) => void;
  onAffiliationFile: (file: File | null) => void;
  onGenerate: () => void;
  pending: boolean;
  error: string | null;
  slideCount: number;
}) {
  const e = data.engagement;
  return (
    <div className="space-y-4 rounded-md border bg-card p-4 text-card-foreground">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Tweet · slide {slideCount > 1 ? "(thread)" : ""}
      </div>

      {/* Persona */}
      <fieldset className="space-y-3">
        <legend className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Persona
        </legend>

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
            hint="Small square logo right of the checkmark — for accounts affiliated with an org."
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

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={savePreset}
            className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] hover:bg-secondary"
          >
            + Save current persona
          </button>
          {presets.length > 0 && (
            <span className="text-[11px] text-muted-foreground">presets:</span>
          )}
          {presets.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full border bg-secondary/50 pl-2.5 pr-1 text-[11px]"
            >
              <button
                type="button"
                onClick={() => loadPreset(p)}
                className="py-0.5 hover:text-foreground"
              >
                {p.label}
              </button>
              <button
                type="button"
                onClick={() => deletePreset(p.id)}
                aria-label={`Delete preset ${p.label}`}
                className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </fieldset>

      {/* Body + post header */}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Time ago (blank to hide)"
            value={data.timeAgo}
            onChange={(v) => patch({ timeAgo: v })}
            placeholder="10h, 3m, Apr 30"
          />
          <Field
            label="Reposted by (blank to hide)"
            value={data.repostedBy}
            onChange={(v) => patch({ repostedBy: v })}
            placeholder="Bob"
          />
        </div>
      </fieldset>

      {/* Visuals — collapsible-feeling row of compact controls */}
      <fieldset className="space-y-2">
        <legend className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Visuals
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
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
              <option value="transparent">Transparent</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-[11px] text-muted-foreground">Font scale</span>
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
          <label className="flex items-end gap-2 pb-1 text-sm">
            <input
              type="checkbox"
              checked={data.border}
              onChange={(ev) => patch({ border: ev.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-xs text-muted-foreground">Card border</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
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
        </div>
      </fieldset>

      {/* Engagement */}
      <fieldset className="space-y-2">
        <div className="flex items-baseline justify-between">
          <legend className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Engagement
          </legend>
          <button
            type="button"
            onClick={randomize}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Randomize
          </button>
        </div>
        <MetricRow
          label="Replies"
          value={e.replies}
          show={e.showReplies}
          onValue={(v) => patchEngagement({ replies: v })}
          onShow={(v) => patchEngagement({ showReplies: v })}
        />
        <MetricRow
          label="Reposts"
          value={e.reposts}
          show={e.showReposts}
          onValue={(v) => patchEngagement({ reposts: v })}
          onShow={(v) => patchEngagement({ showReposts: v })}
        />
        <MetricRow
          label="Likes"
          value={e.likes}
          show={e.showLikes}
          onValue={(v) => patchEngagement({ likes: v })}
          onShow={(v) => patchEngagement({ showLikes: v })}
        />
        <MetricRow
          label="Bookmarks"
          value={e.bookmarks}
          show={e.showBookmarks}
          onValue={(v) => patchEngagement({ bookmarks: v })}
          onShow={(v) => patchEngagement({ showBookmarks: v })}
        />
        <MetricRow
          label="Impressions"
          value={e.impressions}
          show={e.showImpressions}
          onValue={(v) => patchEngagement({ impressions: v })}
          onShow={(v) => patchEngagement({ showImpressions: v })}
        />
      </fieldset>

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
              ? `Generate ${slideCount} PNGs`
              : "Generate PNG"}
        </button>
        <span className="text-[11px] text-muted-foreground">
          {TWEET_CANVAS.width}×{TWEET_CANVAS.height} · LinkedIn portrait
        </span>
      </div>
    </div>
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

function MetricRow({
  label,
  value,
  show,
  onValue,
  onShow,
}: {
  label: string;
  value: number | null;
  show: boolean;
  onValue: (v: number | null) => void;
  onShow: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={show}
        onChange={(ev) => onShow(ev.target.checked)}
        className="h-4 w-4"
        aria-label={`Show ${label}`}
      />
      <span className="w-20 text-xs text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value === null ? "" : String(value)}
        onChange={(ev) => {
          const cleaned = ev.target.value.replace(/[, ]/g, "").trim();
          if (!cleaned) {
            onValue(null);
            return;
          }
          const n = Number(cleaned);
          if (Number.isFinite(n) && n >= 0) onValue(Math.floor(n));
        }}
        placeholder="0"
        disabled={!show}
        className="h-8 flex-1 rounded-md border bg-background px-2 text-xs tabular-nums disabled:opacity-50"
      />
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

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 text-sm">
        Done. {results.length} {results.length === 1 ? "tweet" : "tweets"}{" "}
        rendered.{" "}
        {isThread && (
          <span className="text-muted-foreground">
            Each slide saved as its own post in your archive — open them on
            /posts to track or download.
          </span>
        )}
      </div>

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
