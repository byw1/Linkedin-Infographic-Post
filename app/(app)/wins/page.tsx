import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { WinsView } from "@/components/feed/wins-view";

export const dynamic = "force-dynamic";

export default async function WinsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <main className="container mx-auto max-w-5xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Wins</h1>
        <p className="text-sm text-muted-foreground">
          What&apos;s hitting across the team. Top tracked posts by
          engagement rate or raw reach. Shared by teammates who have{" "}
          <strong>Sharing</strong> on in their settings.
        </p>
      </header>
      <WinsView />
    </main>
  );
}
