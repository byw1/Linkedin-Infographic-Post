import { redirect } from "next/navigation";
import { isFirstRun } from "@/lib/auth";
import { SetupForm } from "@/components/auth/setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!(await isFirstRun())) redirect("/auth/signin");
  return (
    <main className="container mx-auto flex max-w-md flex-col py-16">
      <div className="space-y-6 rounded-lg border p-8">
        <div>
          <h1 className="text-2xl font-bold">Welcome to Infos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create the first account. You&apos;ll be the admin.
          </p>
        </div>
        <SetupForm />
      </div>
    </main>
  );
}
