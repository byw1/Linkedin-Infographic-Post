import { AccessRequestsView } from "@/components/admin/access-requests-view";

export const dynamic = "force-dynamic";

export default function AdminAccessRequestsPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Access requests</h2>
        <p className="text-sm text-muted-foreground">
          Submissions from <code>/welcome/request</code>. Approve to issue an
          invite + email the link to the requester. Decline to leave it on
          file without sending anything. Past decisions stay visible so the
          history doesn&apos;t disappear.
        </p>
      </header>
      <AccessRequestsView />
    </section>
  );
}
