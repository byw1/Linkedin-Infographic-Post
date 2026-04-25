export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

interface ConfigItem {
  key: string;
  value: string | null;
  source: "env" | "db" | "computed";
  secret?: boolean;
  set: boolean;
  editable: boolean;
  notes?: string;
}

const ENV_KEYS: Array<{
  key: string;
  secret?: boolean;
  notes?: string;
}> = [
  { key: "DATABASE_URL", secret: true, notes: "Postgres connection string" },
  { key: "REDIS_URL", secret: true, notes: "Redis connection string" },
  { key: "AUTH_SECRET", secret: true, notes: "openssl rand -base64 32" },
  { key: "S3_ENDPOINT" },
  { key: "S3_REGION" },
  { key: "S3_BUCKET" },
  { key: "S3_PUBLIC_URL" },
  { key: "S3_ACCESS_KEY", secret: true },
  { key: "S3_SECRET_KEY", secret: true },
  { key: "S3_FORCE_PATH_STYLE" },
  { key: "GOOGLE_CLIENT_ID", notes: "Optional. Settings.google overrides this." },
  { key: "GOOGLE_CLIENT_SECRET", secret: true, notes: "Optional." },
  { key: "PUPPETEER_EXECUTABLE_PATH", notes: "Worker only" },
  { key: "RENDER_CONCURRENCY", notes: "Worker only. Default: 2" },
  { key: "NODE_ENV" },
];

function maskSecret(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function maskUrl(value: string): string {
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.username ? "***@" : ""}${u.host}${u.pathname}`;
  } catch {
    return maskSecret(value);
  }
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const env: ConfigItem[] = ENV_KEYS.map(({ key, secret, notes }) => {
    const raw = process.env[key];
    const set = Boolean(raw);
    let value: string | null = null;
    if (set && raw) {
      if (secret) {
        value = key.includes("URL") ? maskUrl(raw) : maskSecret(raw);
      } else {
        value = raw;
      }
    }
    return {
      key,
      value,
      source: "env",
      secret,
      set,
      editable: false,
      notes,
    };
  });

  const settings = await getSettings(true);
  const db: ConfigItem[] = [
    {
      key: "settings.allowedEmails",
      value: settings.allowedEmails.length
        ? `${settings.allowedEmails.length} email(s)`
        : null,
      source: "db",
      set: settings.allowedEmails.length > 0,
      editable: true,
      notes: "Edit in Admin → Email allowlist",
    },
    {
      key: "settings.google",
      value: settings.google?.clientId ?? null,
      source: "db",
      set: Boolean(settings.google?.clientId),
      editable: true,
      notes: "Edit in Admin → Sign-in providers",
    },
  ];

  return NextResponse.json({
    env,
    db,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime_seconds: Math.round(process.uptime()),
    },
  });
}
