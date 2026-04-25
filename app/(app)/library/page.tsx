import { LibraryGrid } from "@/components/library-grid";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  return (
    <main className="container mx-auto max-w-5xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        <p className="text-sm text-muted-foreground">
          Logos you&apos;ve uploaded. They auto-resolve next time you parse HTML
          with the same <code>data-entity</code> slug.
        </p>
      </header>
      <LibraryGrid />
    </main>
  );
}
