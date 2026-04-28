"use client";

export function RenderResult({
  pngUrl,
  onReset,
}: {
  pngUrl: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 text-sm">Done.</div>
      <div className="rounded-md border bg-muted p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pngUrl} alt="rendered infographic" className="mx-auto max-w-full" />
      </div>
      <div className="flex gap-3">
        <a
          href={pngUrl}
          download
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Download PNG
        </a>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center rounded-md border px-5 text-sm font-medium hover:bg-secondary"
        >
          Start another
        </button>
      </div>
    </div>
  );
}
