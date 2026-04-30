import { HealthStatus } from "@/components/admin/health-status";
import { StorageTest } from "@/components/admin/storage-test";

export const dynamic = "force-dynamic";

export default function AdminHealthPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Health</h2>
        <p className="text-sm text-muted-foreground">
          Live status of the worker queue + storage backend.
        </p>
      </header>
      <HealthStatus />
      <StorageTest />
    </section>
  );
}
