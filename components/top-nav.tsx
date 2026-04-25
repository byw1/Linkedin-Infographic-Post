import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

export async function TopNav() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-30">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-base font-semibold tracking-tight">
            LogoSwap
          </Link>
          {user && (
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                New
              </Link>
              <Link
                href="/library"
                className="text-muted-foreground hover:text-foreground"
              >
                Library
              </Link>
              <Link
                href="/settings"
                className="text-muted-foreground hover:text-foreground"
              >
                Settings
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Admin
                </Link>
              )}
            </nav>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/auth/signin" });
              }}
            >
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
