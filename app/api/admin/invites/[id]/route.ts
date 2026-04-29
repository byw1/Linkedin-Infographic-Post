export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendInviteEmail } from "@/lib/email";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const invite = await prisma.invite.findUnique({ where: { id: params.id } });
  if (!invite || invite.createdById !== admin.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invite.usedAt) {
    return NextResponse.json({ error: "Invite already used" }, { status: 409 });
  }
  await prisma.invite.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

// Re-send an existing invite by email. Only works when the invite has an
// email recipient and SMTP is configured. Doesn't rotate the token, so
// any link the admin already shared still works.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const invite = await prisma.invite.findUnique({ where: { id: params.id } });
  if (!invite || invite.createdById !== admin.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invite.usedAt) {
    return NextResponse.json({ error: "Invite already used" }, { status: 409 });
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }
  if (!invite.email) {
    return NextResponse.json(
      { error: "This invite has no email address attached." },
      { status: 400 },
    );
  }
  if (!(await isEmailConfigured())) {
    return NextResponse.json(
      { error: "Email isn't configured. Set SMTP in /admin → Email first." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const inviteUrl = `${proto}://${host}/invite/${invite.token}`;

  try {
    await sendInviteEmail({
      to: invite.email,
      inviteUrl,
      expiresAt: invite.expiresAt,
      inviterName: admin.name ?? null,
      inviterEmail: admin.email ?? null,
      note: invite.note,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Send failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
