import { isStorageConfigured } from "@/lib/storage";
import { LogoSwapFlow } from "@/components/logoswap-flow";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const storageReady = await isStorageConfigured();

  return (
    <main className="container mx-auto max-w-4xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">New infographic</h1>
        <p className="text-sm text-muted-foreground">
          Drop in HTML with <code>data-entity</code> placeholders. Resolve any
          unknown logos, render, download.
        </p>
      </header>

      {!storageReady && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          Storage isn&apos;t configured, so PNG export won&apos;t work yet. Set
          the <code>S3_*</code> env vars on the web and worker services. You can
          still parse HTML and upload logos to test the rest of the flow once
          storage is set up.
        </div>
      )}

      <LogoSwapFlow storageReady={storageReady} />
    </main>
  );
}
