import nodemailer, { type Transporter } from "nodemailer";
import { getSettings, type EmailSettings } from "@/lib/settings";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super(
      "Email isn't configured. Set SMTP credentials in /admin → Email first.",
    );
    this.name = "EmailNotConfiguredError";
  }
}

let cached: { key: string; transporter: Transporter } | null = null;

function buildTransporter(s: EmailSettings): Transporter {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    // Default to STARTTLS on 587; force TLS on 465; let nodemailer
    // negotiate elsewhere.
    secure: s.port === 465,
    auth: { user: s.user, pass: s.password },
  });
}

async function getTransporter(): Promise<{ transporter: Transporter; from: string }> {
  const { email } = await getSettings();
  if (!email) throw new EmailNotConfiguredError();
  const key = JSON.stringify(email);
  if (!cached || cached.key !== key) {
    cached = { key, transporter: buildTransporter(email) };
  }
  return { transporter: cached.transporter, from: email.from };
}

export async function isEmailConfigured(): Promise<boolean> {
  const { email } = await getSettings();
  return email !== null;
}

interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export async function sendMail(args: SendArgs): Promise<void> {
  const { transporter, from } = await getTransporter();
  await transporter.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    replyTo: args.replyTo,
  });
}

export interface InviteEmailArgs {
  to: string;
  inviteUrl: string;
  expiresAt: Date;
  inviterName: string | null;
  inviterEmail: string | null;
  note: string | null;
  appName?: string;
}

// Plain-but-friendly invite email. Intentionally light on styling — the
// goal is "open in any client without breakage" rather than a marketing
// blast. Variables shown to the recipient: the inviter's name/email,
// the link, the expiry date, and the optional note.
export async function sendInviteEmail(args: InviteEmailArgs): Promise<void> {
  const appName = args.appName ?? "viral";
  const inviter = args.inviterName?.trim() || args.inviterEmail || "Someone";
  const expires = args.expiresAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const subject = `${inviter} invited you to ${appName}`;

  const noteBlock = args.note
    ? `\n\nNote from ${inviter}:\n  ${args.note.split("\n").join("\n  ")}`
    : "";
  const text = `${inviter} invited you to ${appName}.

Open this link to accept (expires ${expires}):

  ${args.inviteUrl}${noteBlock}

If you weren't expecting this, you can ignore the email.`;

  const noteHtml = args.note
    ? `<p style="margin:16px 0;padding:12px 14px;background:#f8f7f4;border-left:3px solid #6366f1;color:#3d3d3a;white-space:pre-line"><strong>Note from ${escapeHtml(inviter)}:</strong>\n${escapeHtml(args.note)}</p>`
    : "";
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;background:#fff;padding:24px">
  <div style="max-width:520px;margin:0 auto">
    <h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(inviter)} invited you to ${escapeHtml(appName)}</h1>
    <p style="margin:0 0 18px;color:#555">Click the button below to accept. The link expires on ${expires}.</p>
    <p style="margin:24px 0">
      <a href="${args.inviteUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:500">Accept invite</a>
    </p>
    <p style="font-size:12px;color:#888;word-break:break-all">${args.inviteUrl}</p>${noteHtml}
    <p style="margin-top:24px;font-size:12px;color:#888">If you weren&apos;t expecting this email, you can ignore it.</p>
  </div>
</body></html>`;

  await sendMail({
    to: args.to,
    subject,
    text,
    html,
    replyTo: args.inviterEmail ?? undefined,
  });
}

export function invalidateEmailTransport(): void {
  cached = null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
