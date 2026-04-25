import { redirect } from "next/navigation";
import { auth, isFirstRun } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (await isFirstRun()) redirect("/setup");
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
