import { MembersGrid } from "@/components/members-grid";

export const dynamic = "force-dynamic";

export default function MembersPage() {
  return (
    <main className="container mx-auto max-w-5xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground">
          Everyone using viral. Add tags and link your social accounts on your
          own card; click someone else&apos;s tags to filter.
        </p>
      </header>
      <MembersGrid />
    </main>
  );
}
