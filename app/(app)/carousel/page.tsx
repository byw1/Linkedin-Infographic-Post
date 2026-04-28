import { isStorageConfigured } from "@/lib/storage";
import { CarouselFlow } from "@/components/carousel-flow";

export const dynamic = "force-dynamic";

export default async function CarouselPage() {
  const storageReady = await isStorageConfigured();

  return (
    <main className="container mx-auto max-w-4xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">New carousel</h1>
        <p className="text-sm text-muted-foreground">
          Drop a <code>.zip</code> of 1080×1080 HTML slides (one slide per file).
          Resolve unknown logos once across the whole set, then export a single
          PDF — one page per slide, ready to upload as a LinkedIn document.
        </p>
      </header>

      {!storageReady && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          Storage isn&apos;t configured, so PDF export won&apos;t work yet. Set
          the storage credentials in <code>/admin → Storage</code> first.
        </div>
      )}

      <CarouselFlow storageReady={storageReady} />
    </main>
  );
}
