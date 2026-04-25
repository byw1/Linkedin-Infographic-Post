import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-google"),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
  }),
  z.object({ action: z.literal("disable-google") }),
]);

export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const { google } = await getSettings(true);
  return NextResponse.json({
    google: google ? { clientId: google.clientId, clientSecret: "***" } : null,
  });
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
  if (parsed.data.action === "set-google") {
    await setSetting("google", {
      clientId: parsed.data.clientId.trim(),
      clientSecret: parsed.data.clientSecret.trim(),
    });
  } else {
    await setSetting("google", null);
  }
  return NextResponse.json({ ok: true });
}
