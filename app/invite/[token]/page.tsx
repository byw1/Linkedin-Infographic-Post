import { notFound } from "next/navigation";
import { findValidInvite, InviteError } from "@/lib/invites";
import { InviteRedeemForm } from "@/components/auth/invite-redeem-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: { token: string } }) {
  let invite;
  try {
    invite = await findValidInvite(params.token);
  } catch (err) {
    if (err instanceof InviteError) {
      return (
        <main className="container mx-auto flex max-w-md flex-col py-16">
          <div className="space-y-3 rounded-lg border p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Invite unavailable</h1>
            <p className="text-sm text-muted-foreground">{err.message}</p>
          </div>
        </main>
      );
    }
    notFound();
  }

  return (
    <main className="container mx-auto flex max-w-md flex-col py-16">
      <div className="space-y-6 rounded-lg border p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">You&apos;re invited</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {invite.email
              ? `This invite is for ${invite.email}. Set a password to claim it.`
              : "Set up your account to claim this invite."}
          </p>
        </div>
        <InviteRedeemForm token={params.token} fixedEmail={invite.email ?? null} />
      </div>
    </main>
  );
}
