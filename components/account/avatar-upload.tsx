"use client";

import { useRef, useState, useTransition } from "react";

interface Props {
  currentImage: string | null;
  // Fallback initials shown when there's no image. Computed by the
  // parent so the same string lives in one place across the
  // MemberCard view and edit modes.
  initials: string;
  // Diameter in px. Defaults to 64; profile page passes 80.
  size?: number;
  // Fired with the new browser-fetchable URL after upload, or null
  // after a remove. Parent updates its local state so the avatar
  // refreshes without a route reload.
  onChange: (image: string | null) => void;
  // Override the API endpoint — admin avatar editing on another
  // member targets /api/admin/members/<id>/avatar instead of the
  // self-only /api/account/avatar.
  endpoint?: string;
  // Phrasing for the remove confirm — different copy reads better
  // when an admin is removing someone else's picture vs their own.
  removeConfirm?: string;
}

// Click-to-upload avatar with hover overlay + remove option. Used
// in the MemberCard edit mode and on the profile page when viewing
// your own profile, plus the admin profile-edit panel on
// /members/[id] (with `endpoint` pointed at the admin route).
export function AvatarUpload({
  currentImage,
  initials,
  size = 64,
  onChange,
  endpoint = "/api/account/avatar",
  removeConfirm = "Remove your profile picture?",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pickFile() {
    if (pending) return;
    fileRef.current?.click();
  }

  function upload(file: File) {
    setError(null);
    const form = new FormData();
    form.append("file", file);
    startTransition(async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Upload failed.");
        return;
      }
      const data = await res.json();
      onChange(data.image ?? null);
    });
  }

  function remove() {
    if (pending) return;
    if (!confirm(removeConfirm)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Remove failed.");
        return;
      }
      onChange(null);
    });
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={pickFile}
        disabled={pending}
        className="group relative shrink-0 overflow-hidden rounded-full border bg-secondary disabled:opacity-50"
        style={{ width: size, height: size }}
        title="Change profile picture"
      >
        {currentImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={currentImage}
            alt="Profile picture"
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center font-medium text-muted-foreground"
            style={{ fontSize: Math.round(size / 3) }}
          >
            {initials || "?"}
          </span>
        )}
        <span
          className="absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] font-medium text-transparent transition-colors group-hover:bg-black/50 group-hover:text-white"
        >
          {pending ? "…" : "Change"}
        </span>
      </button>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={pickFile}
          disabled={pending}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {currentImage ? "Replace" : "Upload"}
        </button>
        {currentImage && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.currentTarget.value = "";
        }}
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
