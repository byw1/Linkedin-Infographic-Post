import { signIn } from "@/lib/auth";

export default function SignInPage() {
  return (
    <main className="container mx-auto flex max-w-md flex-col items-center justify-center py-24">
      <div className="w-full space-y-6 rounded-lg border p-8">
        <div>
          <h1 className="text-2xl font-bold">Sign in to LogoSwap</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite-only. Use the email address you were granted access with.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
