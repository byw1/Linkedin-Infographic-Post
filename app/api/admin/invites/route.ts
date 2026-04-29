export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createInvite } from "@/lib/invites";
import { isEmailConfigured, sendInviteEmail } from "@/lib/email";

const Body = z.object({
  email: z.string().email().optional(),
  role: z.enum(["user", "admin"]).default("user"),
  note: z.string().trim().max(200).optional(),
  ttlDays: z.number().int().positive().max(90).optional(),
  // When true, the invite email is delivered immediately. Requires both
  // an email address and configured SMTP. If false / omitted, the API
  // just returns the link for the admin to share manually.
  send_email: z.boolean().optional(),
});

export async function GET() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const invites = await prisma.invite.findMany({
    where: { createdById: admin.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ invites });
}

export async function POST(req: Request) {
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

  const wantsEmail = Boolean(parsed.data.send_email);
  if (wantsEmail) {
    if (!parsed.data.email) {
      return NextResponse.json(
        { error: "Need an email address to send the invite to." },
        { status: 400 },
      );
    }
    if (!(await isEmailConfigured())) {
      return NextResponse.json(
        { error: "Email isn't configured. Set SMTP in /admin → Email first." },
        { status: 503 },
      );
    }
  }

  const invite = await createInvite({
    createdById: admin.id,
    email: parsed.data.email ?? null,
    role: parsed.data.role,
    note: parsed.data.note ?? null,
    ttlDays: parsed.data.ttlDays,
  });

  let emailed = false;
  let emailError: string | null = null;
  if (wantsEmail && invite.email) {
    try {
      const inviteUrl = `${getOrigin(req)}/invite/${invite.token}`;
      await sendInviteEmail({
        to: invite.email,
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

  return NextResponse.json({ invite, emailed, email_error: emailError });
}

function getOrigin(req: Request): string {
  const url = new URL(req.url);
  // Trust the forwarded proto/host pair Railway sets, fall back to the
  // request URL otherwise.
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
