import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { NavMenu } from "@/components/nav-menu";

export async function TopNav() {
  const session = await auth();
  const user = session?.user;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/auth/signin" });
  }

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
            </nav>
          )}
        </div>
        {user && (
          <NavMenu
            email={user.email}
            isAdmin={user.role === "admin"}
            signOutAction={signOutAction}
          />
        )}
      </div>
    </header>
  );
}
