"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as htmlToImage from "html-to-image";
import { RenderResult } from "@/components/render-result";
import {
  TWEET_CANVAS,
  TweetPreview,
  type CheckMark,
  type TweetData,
} from "@/components/tweet-preview";

// Tweet generator. Form on the left (or stacked on phone), live
// preview on the right at scale, "Generate" button rasterizes the
// hidden full-size copy and posts it through /api/render — same
// path the infographic flow uses, just with format=tweet.
//
// Presets save to localStorage (per-browser) — most users will
// have one or two personas they cycle through, and a real
// User-scoped DB store can come later if it turns out people want
// presets shared across devices.

const PRESETS_KEY = "viral.tweet.presets.v1";
const DEFAULT_DATA: TweetData = {
  name: "Display name",
  username: "username",
  avatarUrl: null,
  checkmark: "blue",
  body: "Type your tweet here. Threads coming soon.",
  timeAgo: "10h",
  engagement: {
    replies: 91,
    reposts: 3,
    likes: 172,
    bookmarks: 0,
    impressions: 17_000,
    showReplies: true,
    showReposts: true,
    showLikes: true,
    showBookmarks: false,
    showImpressions: true,
  },
};

interface PresetRow {
  id: string;
  label: string;
  data: TweetData;
}

interface Props {
  storageReady: boolean;
}

type Stage = "edit" | "render";

export function TweetFlow({ storageReady }: Props) {
  const [data, setData] = useState<TweetData>(DEFAULT_DATA);
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [stage, setStage] = useState<Stage>("edit");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [renderId, setRenderId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Load presets on mount. localStorage is fine for browser-local
  // state — real cross-device sync would mean a new model.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (raw) setPresets(JSON.parse(raw) as PresetRow[]);
    } catch {
      // ignore — corrupted JSON just means no presets.
    }
  }, []);

  function persistPresets(next: PresetRow[]) {
    setPresets(next);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  }

  function savePreset() {
    const label = prompt("Preset name?", data.name)?.trim();
    if (!label) return;
    const id = crypto.randomUUID();
    persistPresets([
      ...presets,
      { id, label, data: { ...data, body: "", engagement: { ...data.engagement } } },
    ]);
  }

  function loadPreset(p: PresetRow) {
    // Merge the saved persona over current data, but preserve the
    // body the user is actively typing — most people want to swap
    // the avatar/handle without losing their draft.
    setData((prev) => ({
      ...prev,
      name: p.data.name,
      username: p.data.username,
      avatarUrl: p.data.avatarUrl,
      checkmark: p.data.checkmark,
    }));
  }

  function deletePreset(id: string) {
    persistPresets(presets.filter((p) => p.id !== id));
  }

  async function generate() {
    setError(null);
    if (!storageReady) {
      setError("Storage isn't configured — set it in /admin/health first.");
      return;
    }
    const node = previewRef.current;
    if (!node) {
      setError("Preview not ready yet.");
      return;
    }

    startTransition(async () => {
      try {
        // Capture at 1× the native canvas dimensions; the preview
        // container is already 1080×1350 pixels even though it's
        // displayed at a smaller transform-scale.
        const blob = await htmlToImage.toBlob(node, {
          width: TWEET_CANVAS.width,
          height: TWEET_CANVAS.height,
          pixelRatio: 1,
          // Force a white-on-anything background so transparent
          // pixels in the avatar don't punch through to the page.
          backgroundColor: "#000000",
          // Fonts the preview uses are system-only — but flag this
          // anyway for safety against any web-fonts tucked in CSS.
          cacheBust: true,
        });
        if (!blob) throw new Error("Capture returned no bytes.");

        const filename = `Tweet — ${data.name || data.username}`.slice(0, 80);
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
        setPngUrl(out.png_url);
        setRenderId(out.render_id);
        setStage("render");
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  // Avatar upload — read the file as a data-URL and stash it on
  // the data object. Avoids round-tripping through S3 just to
  // preview, and the rasterizer captures data-URLs cleanly.
  function onAvatarFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setData((d) => ({ ...d, avatarUrl: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  }

  // Roll plausible-looking engagement numbers given a target
  // impressions count. Anchors at 17K (the screenshot the user
  // showed) and uses ratios pulled from typical viral-tweet posts.
  function randomize() {
    const impressions = 1000 + Math.floor(Math.random() * 199_000);
    const likes = Math.floor(impressions * (0.005 + Math.random() * 0.025));
    const replies = Math.floor(likes * (0.05 + Math.random() * 0.2));
    const reposts = Math.floor(likes * (0.005 + Math.random() * 0.05));
    const bookmarks = Math.floor(likes * (0.02 + Math.random() * 0.1));
    setData((d) => ({
      ...d,
      engagement: {
        ...d.engagement,
        impressions,
        likes,
        replies,
        reposts,
        bookmarks,
      },
    }));
  }

  if (stage === "render" && pngUrl && renderId) {
    return (
      <RenderResult
        renderId={renderId}
        url={pngUrl}
        kind="png"
        onReset={() => {
          setStage("edit");
          setPngUrl(null);
          setRenderId(null);
        }}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <Form
        data={data}
        setData={setData}
        presets={presets}
        savePreset={savePreset}
        loadPreset={loadPreset}
        deletePreset={deletePreset}
        randomize={randomize}
        onAvatarFile={onAvatarFile}
        onGenerate={generate}
        pending={pending}
        error={error}
      />

      <PreviewSurface previewRef={previewRef} data={data} />
    </div>
  );
}

function Form({
  data,
  setData,
  presets,
  savePreset,
  loadPreset,
  deletePreset,
  randomize,
  onAvatarFile,
  onGenerate,
  pending,
  error,
}: {
  data: TweetData;
  setData: React.Dispatch<React.SetStateAction<TweetData>>;
  presets: PresetRow[];
  savePreset: () => void;
  loadPreset: (p: PresetRow) => void;
  deletePreset: (id: string) => void;
  randomize: () => void;
  onAvatarFile: (file: File | null) => void;
  onGenerate: () => void;
  pending: boolean;
  error: string | null;
}) {
  const e = data.engagement;
  return (
    <div className="space-y-4 rounded-md border bg-card p-4 text-card-foreground">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Tweet
      </div>

      {/* Persona block */}
      <fieldset className="space-y-3">
        <legend className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Persona
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Display name"
            value={data.name}
            onChange={(v) => setData((d) => ({ ...d, name: v }))}
            placeholder="autumnkyoko"
          />
          <Field
            label="Username"
            value={data.username}
            onChange={(v) =>
              setData((d) => ({ ...d, username: v.replace(/^@/, "") }))
            }
            placeholder="akcushman"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block text-[11px] text-muted-foreground">Avatar</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onAvatarFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs file:mr-2 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground"
            />
            {data.avatarUrl && (
              <button
                type="button"
                onClick={() => setData((d) => ({ ...d, avatarUrl: null }))}
                className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Remove avatar
              </button>
            )}
          </label>
          <label className="block text-sm">
            <span className="block text-[11px] text-muted-foreground">Verified badge</span>
            <select
              value={data.checkmark}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  checkmark: e.target.value as CheckMark,
                }))
              }
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="none">None</option>
              <option value="blue">Blue · individual</option>
              <option value="gold">Gold · organization</option>
              <option value="gray">Gray · government / affiliated</option>
            </select>
          </label>
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
            <span className="text-[11px] text-muted-foreground">
              presets:
            </span>
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

      {/* Body */}
      <fieldset className="space-y-2">
        <legend className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Tweet body
        </legend>
        <textarea
          value={data.body}
          onChange={(e) => setData((d) => ({ ...d, body: e.target.value }))}
          rows={5}
          maxLength={4000}
          placeholder="Type the tweet text. Multi-line + line breaks work."
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        <Field
          label="Time ago"
          value={data.timeAgo}
          onChange={(v) => setData((d) => ({ ...d, timeAgo: v }))}
          placeholder="10h, 3m, Apr 30"
        />
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
          onValue={(v) =>
            setData((d) => ({ ...d, engagement: { ...d.engagement, replies: v } }))
          }
          onShow={(v) =>
            setData((d) => ({ ...d, engagement: { ...d.engagement, showReplies: v } }))
          }
        />
        <MetricRow
          label="Reposts"
          value={e.reposts}
          show={e.showReposts}
          onValue={(v) =>
            setData((d) => ({ ...d, engagement: { ...d.engagement, reposts: v } }))
          }
          onShow={(v) =>
            setData((d) => ({ ...d, engagement: { ...d.engagement, showReposts: v } }))
          }
        />
        <MetricRow
          label="Likes"
          value={e.likes}
          show={e.showLikes}
          onValue={(v) =>
            setData((d) => ({ ...d, engagement: { ...d.engagement, likes: v } }))
          }
          onShow={(v) =>
            setData((d) => ({ ...d, engagement: { ...d.engagement, showLikes: v } }))
          }
        />
        <MetricRow
          label="Bookmarks"
          value={e.bookmarks}
          show={e.showBookmarks}
          onValue={(v) =>
            setData((d) => ({ ...d, engagement: { ...d.engagement, bookmarks: v } }))
          }
          onShow={(v) =>
            setData((d) => ({ ...d, engagement: { ...d.engagement, showBookmarks: v } }))
          }
        />
        <MetricRow
          label="Impressions"
          value={e.impressions}
          show={e.showImpressions}
          onValue={(v) =>
            setData((d) => ({
              ...d,
              engagement: { ...d.engagement, impressions: v },
            }))
          }
          onShow={(v) =>
            setData((d) => ({
              ...d,
              engagement: { ...d.engagement, showImpressions: v },
            }))
          }
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
          {pending ? "Rendering..." : "Generate PNG"}
        </button>
        <span className="text-[11px] text-muted-foreground">
          1080×1350 · ready for LinkedIn portrait
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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
      />
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
        onChange={(e) => onShow(e.target.checked)}
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
  // image needs the un-transformed element so it can grab the right
  // pixel dimensions. The visual shrink is on the wrapper around
  // it: a scaled <div> with overflow hidden, sized to the post-
  // scale footprint so layout doesn't leave a giant gap.
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
            // Lock the inner box to native size so the scale wraps
            // a known-quantity child and the parent's overflow:hidden
            // does the visual crop predictably.
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
