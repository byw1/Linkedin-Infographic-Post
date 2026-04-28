"use client";

export function RenderResult({
  url,
  kind = "png",
  onReset,
}: {
  url: string;
  kind?: "png" | "pdf";
  onReset: () => void;
}) {
  const isPdf = kind === "pdf";
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 text-sm">Done.</div>
      {isPdf ? (
        <object
          data={url}
          type="application/pdf"
          className="block h-[600px] w-full rounded-md border bg-muted"
        >
          <p className="p-4 text-sm text-muted-foreground">
            PDF preview not supported here.{" "}
            <a href={url} className="underline" target="_blank" rel="noreferrer">
              Open in a new tab
            </a>
            .
          </p>
        </object>
      ) : (
        <div className="rounded-md border bg-muted p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="rendered infographic" className="mx-auto max-w-full" />
        </div>
      )}
      <div className="flex gap-3">
        <a
          href={url}
          download
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {isPdf ? "Download PDF" : "Download PNG"}
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
