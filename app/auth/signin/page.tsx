import { redirect } from "next/navigation";
import { isFirstRun } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SignInForm } from "@/components/auth/sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await isFirstRun()) redirect("/setup");
  const { google } = await getSettings();
  const googleEnabled = Boolean(google?.clientId && google?.clientSecret);

  return (
    <main className="container mx-auto flex max-w-md flex-col py-16">
      <div className="space-y-6 rounded-lg border p-8">
        <div>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the email and password you set up. Don&apos;t have an account?
            Ask the admin for an invite link.
          </p>
        </div>
        <SignInForm googleEnabled={googleEnabled} />
      </div>
    </main>
  );
}
