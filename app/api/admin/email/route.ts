export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";
import { invalidateEmailTransport, sendMail } from "@/lib/email";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    host: z.string().min(1).max(200),
    port: z.coerce.number().int().min(1).max(65535),
    user: z.string().min(1).max(200),
    password: z.string().min(1).max(400),
    from: z.string().min(1).max(200),
  }),
  z.object({ action: z.literal("disable") }),
  z.object({
    action: z.literal("test"),
    to: z.string().email(),
  }),
]);

export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const { email } = await getSettings(true);
  return NextResponse.json({
    // Don't leak the password — same shape as the auth-providers GET.
    email: email
      ? {
          host: email.host,
          port: email.port,
          user: email.user,
          password: "***",
          from: email.from,
        }
      : null,
  });
}

export async function PUT(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.action === "set") {
    await setSetting("email", {
      host: parsed.data.host.trim(),
      port: parsed.data.port,
      user: parsed.data.user.trim(),
      password: parsed.data.password,
      from: parsed.data.from.trim(),
    });
    invalidateEmailTransport();
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "disable") {
    await setSetting("email", null);
    invalidateEmailTransport();
    return NextResponse.json({ ok: true });
  }

  // action === "test" — verifies the saved SMTP creds reach a live server.
  try {
    await sendMail({
      to: parsed.data.to,
      subject: "Viral: test email",
      text: `Hi ${admin.email ?? ""},

This is a test from Viral's admin panel. If you got it, your SMTP settings are working.

— Viral`,
      html: `<p>Hi ${admin.email ?? ""},</p><p>This is a test from Viral's admin panel. If you got it, your SMTP settings are working.</p><p>— Viral</p>`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Send failed: ${(err as Error).message}`,
      },
      { status: 502 },
    );
  }
}
