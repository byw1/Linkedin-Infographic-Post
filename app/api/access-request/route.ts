export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendMail } from "@/lib/email";

// Public access-request endpoint. /welcome/request posts here. We
// don't store the row anywhere — admins decide if they want to
// invite via /admin/invites which is the auth-creating side. Email
// goes to every admin so any of them can act on it.
//
// Light-weight bot filter: a honeypot field on the form (`hp`) is
// invisible to real users; any non-empty value short-circuits to a
// silent OK so the bot thinks it succeeded.
const Body = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  linkedin: z
    .string()
    .trim()
    .url()
    .max(300)
    .refine((v) => /linkedin\.com/i.test(v), {
      message: "That doesn't look like a LinkedIn URL.",
    }),
  industry: z.string().trim().min(1).max(120),
  skills: z.string().trim().min(1).max(800),
  referrer: z.string().trim().min(1).max(200),
  hp: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { name, email, linkedin, industry, skills, referrer, hp } = parsed.data;

  // Bot filled the honeypot. Pretend success.
  if (hp && hp.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  if (!(await isEmailConfigured())) {
    // Soft fail: still tell the user it worked. The admin can
    // configure SMTP and the next request will go through. Logging
    // here is the only way they'll see the missed request — a
    // future enhancement could persist these.
    console.warn(
      "[access-request] email not configured; request would have gone to admins:",
      { name, email, linkedin, industry, referrer },
    );
    return NextResponse.json({ ok: true });
  }

  const admins = await prisma.user.findMany({
    where: { role: "admin", bannedAt: null },
    select: { email: true },
  });
  if (admins.length === 0) {
    console.warn("[access-request] no admins to email; request dropped");
    return NextResponse.json({ ok: true });
  }

  const subject = `[viral] Access request from ${name}`;
  const lines = [
    `${name} (${email}) is asking for access.`,
    ``,
    `LinkedIn:  ${linkedin}`,
    `Industry:  ${industry}`,
    `Referrer:  ${referrer}`,
    ``,
    `Skills + niche:`,
    skills,
    ``,
    `If they're a fit, create an invite for them in /admin/invites.`,
  ];
  const text = lines.join("\n");
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;background:#fff;padding:24px">
  <div style="max-width:560px;margin:0 auto">
    <h1 style="font-size:18px;margin:0 0 12px">Access request from ${escapeHtml(name)}</h1>
    <p style="margin:0 0 18px;color:#555">${escapeHtml(email)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tbody>
        ${row("LinkedIn", `<a href="${encodeURI(linkedin)}">${escapeHtml(linkedin)}</a>`)}
        ${row("Industry", escapeHtml(industry))}
        ${row("Referrer", escapeHtml(referrer))}
      </tbody>
    </table>
    <h3 style="margin-top:20px;font-size:14px">Skills + niche</h3>
    <p style="margin:6px 0 18px;padding:12px;background:#f6f6f5;border-radius:6px;white-space:pre-wrap">${escapeHtml(skills)}</p>
    <p style="font-size:13px;color:#555">If they&apos;re a fit, create an invite at <code>/admin/invites</code>.</p>
  </div>
</body></html>`;

  // Send to all admins in parallel. Failures on one admin don't
  // block the others (private community, this volume is tiny).
  await Promise.all(
    admins.map(async (a) => {
      try {
        await sendMail({
          to: a.email,
          subject,
          text,
          html,
          replyTo: email,
        });
      } catch (err) {
        console.error(
          `[access-request] failed to email ${a.email}`,
          (err as Error).message,
        );
      }
    }),
  );

  return NextResponse.json({ ok: true });
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;color:#666;width:80px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0">${value}</td></tr>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
