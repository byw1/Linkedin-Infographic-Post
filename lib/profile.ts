import { z } from "zod";

// Known social providers surfaced as labeled fields on the profile
// editor. Anything else can go under `website`. Each value is the
// recipient-facing URL (already normalized — see `normalizeSocialUrl`).
export const SOCIAL_KEYS = [
  "linkedin",
  "twitter",
  "github",
  "instagram",
  "website",
] as const;

export type SocialKey = (typeof SOCIAL_KEYS)[number];
export type SocialMap = Partial<Record<SocialKey, string>>;

// Username/handle prefixes for the providers that accept them. Used by
// normalizeSocialUrl to expand "@bywilliaml" into a full URL.
const HANDLE_BASES: Partial<Record<SocialKey, string>> = {
  linkedin: "https://www.linkedin.com/in/",
  twitter: "https://twitter.com/",
  github: "https://github.com/",
  instagram: "https://www.instagram.com/",
};

export function normalizeSocialUrl(key: SocialKey, raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Plain handle like "@bywilliaml" or "bywilliaml" — expand using the
  // provider's base URL when we know one.
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.includes("/") && HANDLE_BASES[key]) {
    const handle = trimmed.replace(/^@/, "");
    if (!handle) return null;
    try {
      return new URL(handle, HANDLE_BASES[key]!).toString();
    } catch {
      return null;
    }
  }
  // Bare hostname like "example.com" — assume https.
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const SocialsSchema = z
  .record(z.enum(SOCIAL_KEYS), z.string().trim().max(300))
  .transform((raw) => {
    const out: SocialMap = {};
    for (const k of SOCIAL_KEYS) {
      const v = raw[k];
      if (!v) continue;
      const normalized = normalizeSocialUrl(k, v);
      if (normalized) out[k] = normalized;
    }
    return out;
  });

const TAG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function normalizeTag(raw: string): string | null {
  const t = raw
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!t) return null;
  if (!TAG_PATTERN.test(t)) return null;
  if (t.length > 32) return null;
  return t;
}

export const TagsSchema = z
  .array(z.string().trim().max(40))
  .max(20)
  .transform((tags) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tags) {
      const t = normalizeTag(raw);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  });

// Coerce raw JSON from the database (Prisma returns Json) into a typed
// SocialMap, dropping anything we don't recognize.
export function readSocials(value: unknown): SocialMap {
  if (!value || typeof value !== "object") return {};
  const out: SocialMap = {};
  for (const k of SOCIAL_KEYS) {
    const v = (value as Record<string, unknown>)[k];
    if (typeof v === "string" && v) out[k] = v;
  }
  return out;
}
