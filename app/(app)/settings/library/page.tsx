import { LibraryView } from "@/components/library-view";

export const dynamic = "force-dynamic";

export default function SettingsLibraryPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Library</h2>
        <p className="text-sm text-muted-foreground">
          Logos uploaded by everyone in the community. They auto-resolve next
          time you parse HTML with the same <code>data-entity</code> slug.
          Hide ones you don&apos;t want to see — your logos stay in the pool
          for everyone else.
        </p>
      </header>
      <LibraryView />
    </section>
  );
}
