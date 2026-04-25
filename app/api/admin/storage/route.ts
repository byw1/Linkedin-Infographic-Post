import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";

const Body = z.object({
  endpoint: z.string().url(),
  region: z.string().min(1).default("auto"),
  bucket: z.string().min(1),
  publicUrl: z.string().url(),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  forcePathStyle: z.boolean().default(false),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const { storage } = await getSettings(true);
  if (!storage) return NextResponse.json({ storage: null });
  return NextResponse.json({
    storage: { ...storage, accessKey: "***", secretKey: "***" },
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
  await setSetting("storage", parsed.data);
  return NextResponse.json({ ok: true });
}
