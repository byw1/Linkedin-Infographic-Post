"use client";

import { useEffect, useState, useTransition } from "react";

interface Check {
  name: string;
  status: "ok" | "down" | "warn";
  detail?: string;
  meta?: Record<string, unknown>;
}

// Signal is attention; Concrete is quiet. The status label next to the
// dot ("OK" / "WARN" / "DOWN") is what actually names the state.
const COLORS: Record<Check["status"], string> = {
  ok: "bg-concrete",
  warn: "bg-signal",
  down: "bg-signal",
};

export function HealthStatus() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setChecks(data.checks);
      setGenerated(data.generated_at);
    });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-3 border p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {generated
            ? `Last checked ${new Date(generated).toLocaleTimeString()}`
            : "Loading..."}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={pending}
          className="inline-flex h-8 items-center border px-3 text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
        >
          {pending ? "Checking..." : "Refresh"}
        </button>
      </div>
      {checks && (
        <ul className="space-y-2 text-sm">
          {checks.map((c) => (
            <li key={c.name} className="flex items-start gap-3">
              <span
                className={`mt-1.5 inline-block h-2 w-2 ${COLORS[c.status]}`}
                aria-label={c.status}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium capitalize">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.status}
                  </span>
                </div>
                {c.detail && (
                  <div className="text-xs text-muted-foreground">
                    {c.detail}
                  </div>
                )}
                {c.meta && (
                  <div className="mt-1 grid grid-cols-2 gap-x-4 text-xs text-muted-foreground sm:grid-cols-3">
                    {Object.entries(c.meta).map(([k, v]) => (
                      <div key={k}>
                        <span className="capitalize">{k}</span>:{" "}
                        <span>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
