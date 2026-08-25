import { cookies } from "next/headers";
import { AlertTriangle } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStorageConfigured } from "@/lib/storage";
import { ModeSwitcher } from "@/components/mode-switcher";
import { PageHeader } from "@/components/ui/page";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [storageReady, session] = await Promise.all([
    isStorageConfigured(),
    auth(),
  ]);

  // The infographic walkthrough opens on its own only for someone who
  // hasn't made a post yet and hasn't waved it away. Both halves are
  // resolved here rather than on the client so the video never flashes
  // in for a returning user before collapsing. `take: 1` — we only care
  // whether any row exists, not how many.
  const userId = session?.user?.id;
  const hasRendered = userId
    ? (await prisma.render.findFirst({
        where: { userId },
        select: { id: true },
      })) !== null
    : true;
  const dismissedTutorial =
    cookies().get("infographic_tutorial_seen")?.value === "1";

  return (
    <main className="container mx-auto max-w-4xl py-10">
      <PageHeader
        title="New post"
        description="Turn HTML from Claude into a LinkedIn-ready image. Pick a format, paste your source, resolve any logos, export."
      />

      {!storageReady && (
        <div className="mb-6 flex items-start gap-3 border-l-2 border-signal py-3 pl-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-signal" />
          <p className="text-chalk">
            Storage isn&apos;t configured, so export won&apos;t work yet. Set
            storage credentials in{" "}
            <code className="font-mono text-signal">/admin/health</code> first.
          </p>
        </div>
      )}

      <ModeSwitcher
        storageReady={storageReady}
        showTutorial={!hasRendered && !dismissedTutorial}
      />
    </main>
  );
}
