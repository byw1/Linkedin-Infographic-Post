import { redirect } from "next/navigation";
import { auth, isFirstRun } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (await isFirstRun()) redirect("/setup");
  const session = await auth();
  // Signed-out visitors land on the public marketing page instead
  // of the bare sign-in form. /welcome surfaces a "Sign in" link
  // for returning members and "Request access" for prospective ones.
  if (!session?.user) redirect("/welcome");

  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
