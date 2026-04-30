import { ConfigView } from "@/components/admin/config-view";

export const dynamic = "force-dynamic";

export default function AdminConfigPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Everything the app sees right now. Env vars are set on Railway and
          shown read-only with secrets masked. Database settings are editable
          in the sections above.
        </p>
      </header>
      <ConfigView />
    </section>
  );
}
