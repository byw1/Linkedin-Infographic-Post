"use client";

import { useEffect, useState } from "react";

interface ConfigItem {
  key: string;
  value: string | null;
  source: "env" | "db" | "computed";
  secret?: boolean;
  set: boolean;
  editable: boolean;
  notes?: string;
}

interface ConfigData {
  env: ConfigItem[];
  db: ConfigItem[];
  runtime: {
    node: string;
    platform: string;
    arch: string;
    uptime_seconds: number;
  };
}

// Read-only display of the runtime + environment variables. The
// editable database settings (SMTP, Google OAuth, allowlist) are
// rendered separately on /admin/config as proper forms — no point
// duplicating them here. Env vars stay read-only because the app
// process can't rewrite Railway's injected env at runtime.
export function ConfigView() {
  const [data, setData] = useState<ConfigData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/admin/config", { cache: "no-store" });
      if (!res.ok || cancelled) return;
      setData(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="border p-3 text-xs text-muted-foreground">
        Node {data.runtime.node} · {data.runtime.platform}/{data.runtime.arch} ·
        up {Math.floor(data.runtime.uptime_seconds / 60)}m
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-semibold">Environment variables</h3>
          <span className="text-xs text-muted-foreground">
            (read-only — set on Railway)
          </span>
        </div>
        <div className="overflow-hidden border text-sm">
          <table className="w-full">
            <tbody>
              {data.env.map((c) => (
                <tr key={c.key} className="border-b last:border-b-0">
                  <td className="w-1/3 bg-muted/50 px-3 py-2 align-top font-mono text-xs">
                    <div>{c.key}</div>
                    {c.notes && (
                      <div className="text-[10px] font-sans text-muted-foreground">
                        {c.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {c.set ? (
                      <span className="font-mono text-xs">{c.value}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        not set
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
