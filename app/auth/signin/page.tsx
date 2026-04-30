import { redirect } from "next/navigation";
import { isFirstRun } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SignInCard2 } from "@/components/ui/sign-in-card-2";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await isFirstRun()) redirect("/setup");
  const { google } = await getSettings();
  const googleEnabled = Boolean(google?.clientId && google?.clientSecret);

  return <SignInCard2 googleEnabled={googleEnabled} />;
}
