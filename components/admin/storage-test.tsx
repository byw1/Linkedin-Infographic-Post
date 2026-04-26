"use client";

import { useState, useTransition } from "react";

interface StepResult {
  step: string;
  ok: boolean;
  detail?: string;
  ms?: number;
}

interface TestResult {
  ok: boolean;
  config: {
    endpoint: string;
    region: string;
    bucket: string;
    forcePathStyle: boolean;
    publicUrlMode: string;
    accessKey: string;
  } | null;
  steps: StepResult[];
  error?: string;
}

export function StorageTest() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setResult(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/storage-test", { method: "POST" });
      const data = (await res.json()) as TestResult;
      setResult(data);
    });
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Storage round-trip</div>
          <div className="text-xs text-muted-foreground">
            Performs HeadBucket → PutObject → GetObject → DeleteObject against the
            configured bucket. Tells you exactly which step S3 rejects.
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary disabled:opacity-50"
        >
          {pending ? "Testing..." : "Test storage"}
        </button>
      </div>

      {result?.error && <p className="text-sm text-destructive">{result.error}</p>}

      {result?.config && (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            <Cfg label="Endpoint" value={result.config.endpoint} />
            <Cfg label="Region" value={result.config.region} />
            <Cfg label="Bucket" value={result.config.bucket} />
            <Cfg label="Path-style" value={String(result.config.forcePathStyle)} />
            <Cfg label="Access key" value={result.config.accessKey} />
            <Cfg label="Public URL" value={result.config.publicUrlMode} />
          </div>
          <ul className="space-y-1 pt-2">
            {result.steps.map((s) => (
              <li key={s.step} className="flex items-start gap-2">
                <span
                  className={`mt-1.5 inline-block h-2 w-2 rounded-full ${s.ok ? "bg-green-500" : "bg-red-500"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{s.step}</span>
                    {s.ms !== undefined && (
                      <span className="text-muted-foreground">{s.ms}ms</span>
                    )}
                  </div>
                  {s.detail && (
                    <div className="break-words text-destructive">{s.detail}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Cfg({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="truncate font-mono">{value}</div>
    </div>
  );
}
