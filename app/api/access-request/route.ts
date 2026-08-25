export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendMail } from "@/lib/email";

// Public access-request endpoint. /welcome/request posts here.
// Persists the request as an AccessRequest row so admins can
// review, approve (issues an invite + emails it), or decline from
// /admin/access-requests. Also fires a heads-up email to every
// admin with a deep-link to the review surface.
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

  // Persist first so the admin review surface picks it up even if
  // SMTP isn't configured / fails. The notification email below is
  // a courtesy ping to admins, not the system of record.
  await prisma.accessRequest.create({
    data: { name, email, linkedin, industry, skills, referrer },
  });

  if (!(await isEmailConfigured())) {
    console.warn(
      "[access-request] saved row but email not configured; admins won't be pinged until SMTP is set",
    );
    return NextResponse.json({ ok: true });
  }

  const admins = await prisma.user.findMany({
    where: { role: "admin", bannedAt: null },
    select: { email: true },
  });
  if (admins.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const reviewUrl = `${getOrigin(req)}/admin/access-requests`;
  const subject = `[Viral] Access request from ${name}`;
  const text = [
    `${name} (${email}) is asking for access.`,
    ``,
    `LinkedIn:  ${linkedin}`,
    `Industry:  ${industry}`,
    `Referrer:  ${referrer}`,
    ``,
    `Skills + niche:`,
    skills,
    ``,
    `Review at: ${reviewUrl}`,
  ].join("\n");
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
    <p style="margin:24px 0">
      <a href="${reviewUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:500">Review &amp; approve</a>
    </p>
    <p style="font-size:12px;color:#888;word-break:break-all">${reviewUrl}</p>
  </div>
</body></html>`;

  // Fire-and-forget: don't block the response on email delivery,
  // and tolerate per-admin failures (private community, tiny scale).
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

function getOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
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
