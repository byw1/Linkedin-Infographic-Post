"use client";

import { useState, useTransition } from "react";
import type { StorageSettings } from "@/lib/settings";

const FIELDS: Array<{
  key: keyof StorageSettings;
  label: string;
  placeholder?: string;
  type?: "text" | "password";
}> = [
  { key: "endpoint", label: "Endpoint", placeholder: "https://<acct>.r2.cloudflarestorage.com" },
  { key: "region", label: "Region", placeholder: "auto" },
  { key: "bucket", label: "Bucket", placeholder: "logoswap" },
  { key: "publicUrl", label: "Public URL", placeholder: "https://pub-<id>.r2.dev" },
  { key: "accessKey", label: "Access key", type: "password" },
  { key: "secretKey", label: "Secret key", type: "password" },
];

const EMPTY: StorageSettings = {
  endpoint: "",
  region: "auto",
  bucket: "",
  publicUrl: "",
  accessKey: "",
  secretKey: "",
  forcePathStyle: false,
};

export function StorageForm({ initial }: { initial: StorageSettings | null }) {
  const [form, setForm] = useState<StorageSettings>(initial ?? EMPTY);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setMessage(res.ok ? "Saved." : "Save failed.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{f.label}</span>
            <input
              type={f.type ?? "text"}
              value={String(form[f.key] ?? "")}
              placeholder={f.placeholder}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.forcePathStyle}
          onChange={(e) => setForm({ ...form, forcePathStyle: e.target.checked })}
        />
        <span>Force path-style URLs (needed for MinIO, not R2)</span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save storage"}
        </button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
