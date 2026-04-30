export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendInviteEmail } from "@/lib/email";
import { createInvite } from "@/lib/invites";

// Approve → flips status, issues an Invite (locked to the
// requester's email), and emails the link via the existing invite
// flow. Decline → flips status only, no email; silence is gentler
// than a rejection note.
const Body = z.object({
  action: z.enum(["approve", "decline"]),
  // Optional admin note; passed through to the invite email so the
  // requester sees the same context the inviter would have written
  // manually from /admin/invites.
  note: z.string().trim().max(200).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { action, note } = parsed.data;

  const request = await prisma.accessRequest.findUnique({
    where: { id: params.id },
  });
  if (!request) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json(
      { error: `Already ${request.status}.` },
      { status: 400 },
    );
  }

  if (action === "decline") {
    await prisma.accessRequest.update({
      where: { id: request.id },
      data: {
        status: "declined",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, status: "declined" });
  }

  // Approve path. Reject early if the email already belongs to a
  // member — no need to issue an invite, and silently dropping it
  // would be confusing for the admin.
  const existing = await prisma.user.findUnique({
    where: { email: request.email.toLowerCase() },
  });
  if (existing) {
    await prisma.accessRequest.update({
      where: { id: request.id },
      data: {
        status: "approved",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({
      ok: true,
      status: "approved",
      already_member: true,
    });
  }

  // Issue the invite locked to the requester's email. The note (if
  // any) shows up in the invite email body, same as a manual invite.
  const invite = await createInvite({
    createdById: admin.id,
    email: request.email,
    role: "user",
    note: note ?? null,
  });

  let emailed = false;
  let emailError: string | null = null;
  if (await isEmailConfigured()) {
    try {
      const inviteUrl = `${getOrigin(req)}/invite/${invite.token}`;
      await sendInviteEmail({
        to: invite.email!,
        inviteUrl,
        expiresAt: invite.expiresAt,
        inviterName: admin.name ?? null,
        inviterEmail: admin.email ?? null,
        note: invite.note,
      });
      emailed = true;
    } catch (err) {
      emailError = (err as Error).message;
    }
  }

  await prisma.accessRequest.update({
    where: { id: request.id },
    data: {
      status: "approved",
      reviewedById: admin.id,
      reviewedAt: new Date(),
      inviteId: invite.id,
    },
  });

  return NextResponse.json({
    ok: true,
    status: "approved",
    invite_id: invite.id,
    emailed,
    email_error: emailError,
  });
}

function getOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
