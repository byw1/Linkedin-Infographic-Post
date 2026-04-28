import { isStorageConfigured } from "@/lib/storage";
import { ModeSwitcher } from "@/components/mode-switcher";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const storageReady = await isStorageConfigured();

  return (
    <main className="container mx-auto max-w-4xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">New post</h1>
      </header>

      {!storageReady && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          Storage isn&apos;t configured, so export won&apos;t work yet. Set
          storage credentials in <code>/admin → Storage</code> first.
        </div>
      )}

      <ModeSwitcher storageReady={storageReady} />
    </main>
  );
}
