import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="container mx-auto max-w-3xl py-16">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">LogoSwap</h1>
          <p className="mt-2 text-muted-foreground">
            Drop in an HTML infographic. Auto-resolve logos from your library. Export a sharp PNG.
          </p>
        </div>

        {session?.user ? (
          <div className="space-y-4 rounded-lg border p-6">
            <div className="text-sm">
              Signed in as <span className="font-medium">{session.user.email}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/library"
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Open library
              </Link>
              {session.user.role === "admin" && (
                <Link
                  href="/admin"
                  className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-secondary"
                >
                  Admin
                </Link>
              )}
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-secondary"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in with Google
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
