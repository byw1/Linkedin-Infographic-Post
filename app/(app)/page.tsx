import { isStorageConfigured } from "@/lib/storage";
import { ModeSwitcher } from "@/components/mode-switcher";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const storageReady = await isStorageConfigured();

  return (
    <main className="container mx-auto max-w-4xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New post</h1>
      </header>

      {!storageReady && (
        <div className="rounded-xl border border-warning/30 bg-warning-bg p-4 text-sm text-warning shadow">
          Storage isn&apos;t configured, so export won&apos;t work yet. Set
          storage credentials in <code>/admin/health</code> first.
        </div>
      )}

      <ModeSwitcher storageReady={storageReady} />
    </main>
  );
}
