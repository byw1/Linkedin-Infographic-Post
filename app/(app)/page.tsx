import { AlertTriangle } from "lucide-react";
import { isStorageConfigured } from "@/lib/storage";
import { ModeSwitcher } from "@/components/mode-switcher";
import { PageHeader } from "@/components/ui/page";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const storageReady = await isStorageConfigured();

  return (
    <main className="container mx-auto max-w-4xl py-10">
      <PageHeader
        title="New post"
        description="Turn HTML from Claude into a LinkedIn-ready image. Pick a format, paste your source, resolve any logos, export."
      />

      {!storageReady && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-bg p-4 text-sm shadow">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-warning">
            Storage isn&apos;t configured, so export won&apos;t work yet. Set
            storage credentials in{" "}
            <code className="rounded bg-warning/10 px-1 py-0.5 font-mono">
              /admin/health
            </code>{" "}
            first.
          </p>
        </div>
      )}

      <ModeSwitcher storageReady={storageReady} />
    </main>
  );
}
