export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";

const Body = z.object({
  emails: z.array(z.string().email()).max(500),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const { allowedEmails } = await getSettings(true);
  return NextResponse.json({ emails: allowedEmails });
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const normalized = Array.from(
    new Set(parsed.data.emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  );
  await setSetting("allowedEmails", normalized);
  return NextResponse.json({ ok: true, count: normalized.length });
}
