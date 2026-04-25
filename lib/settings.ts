import { prisma } from "@/lib/db";

export interface StorageSettings {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl: string;
  forcePathStyle: boolean;
}

export interface EmailSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export interface GoogleAuthSettings {
  clientId: string;
  clientSecret: string;
}

export type SettingsMap = {
  allowedEmails: string[];
  storage: StorageSettings | null;
  email: EmailSettings | null;
  google: GoogleAuthSettings | null;
};

const DEFAULTS: SettingsMap = {
  allowedEmails: [],
  storage: null,
  email: null,
  google: null,
};

const TTL_MS = 30_000;
let cache: { value: SettingsMap; expiresAt: number } | null = null;

function envAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function envStorage(): StorageSettings | null {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET;
  const publicUrl = process.env.S3_PUBLIC_URL;
  if (!endpoint || !accessKey || !secretKey || !bucket || !publicUrl) return null;
  return {
    endpoint,
    region: process.env.S3_REGION ?? "auto",
    accessKey,
    secretKey,
    bucket,
    publicUrl,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

function envEmail(): EmailSettings | null {
  const host = process.env.EMAIL_SERVER_HOST;
  const user = process.env.EMAIL_SERVER_USER;
  const password = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM;
  if (!host || !user || !password || !from) return null;
  return {
    host,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    user,
    password,
    from,
  };
}

function envGoogle(): GoogleAuthSettings | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function loadFromDb(): Promise<Partial<SettingsMap>> {
  try {
    const rows = await prisma.setting.findMany();
    const map: Partial<SettingsMap> = {};
    for (const row of rows) {
      if (row.key === "allowedEmails") {
        map.allowedEmails = Array.isArray(row.value)
          ? (row.value as string[]).map((e) => e.toLowerCase())
          : [];
      } else if (row.key === "storage") {
        map.storage = (row.value as unknown as StorageSettings) ?? null;
      } else if (row.key === "email") {
        map.email = (row.value as unknown as EmailSettings) ?? null;
      } else if (row.key === "google") {
        map.google = (row.value as unknown as GoogleAuthSettings) ?? null;
      }
    }
    return map;
  } catch {
    return {};
  }
}

export async function getSettings(force = false): Promise<SettingsMap> {
  if (!force && cache && cache.expiresAt > Date.now()) return cache.value;

  const fromDb = await loadFromDb();
  const merged: SettingsMap = {
    allowedEmails: fromDb.allowedEmails?.length ? fromDb.allowedEmails : envAllowedEmails(),
    storage: fromDb.storage ?? envStorage(),
    email: fromDb.email ?? envEmail(),
    google: fromDb.google ?? envGoogle(),
  };

  cache = { value: merged, expiresAt: Date.now() + TTL_MS };
  return merged;
}

export async function setSetting<K extends keyof SettingsMap>(
  key: K,
  value: SettingsMap[K],
): Promise<void> {
  await prisma.setting.upsert({
    where: { key: key as string },
    create: { key: key as string, value: value as never },
    update: { value: value as never, updatedAt: new Date() },
  });
  cache = null;
}

export function invalidateSettingsCache(): void {
  cache = null;
}

export function getBootstrapAdminEmail(): string | null {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

export function _internalDefaults(): SettingsMap {
  return DEFAULTS;
}
