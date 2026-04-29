export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";
import { DEFAULT_DOCS } from "@/lib/docs-default";

// Read is open to any signed-in user. The page is the team's handbook.
export async function GET() {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }
  const { docs } = await getSettings();
  return NextResponse.json({
    docs: docs ?? {
      markdown: DEFAULT_DOCS,
      updatedAt: null,
      updatedById: null,
      updatedByName: null,
    },
    customized: docs !== null,
  });
}

const Body = z.object({
  markdown: z.string().max(200_000),
});

// Write is admin-only. Anything within the 200k char limit is fine —
// the page is just rendered with react-markdown + remark-gfm, so HTML
// is escaped by default.
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
  await setSetting("docs", {
    markdown: parsed.data.markdown,
    updatedAt: new Date().toISOString(),
    updatedById: admin.id,
    updatedByName: admin.name ?? admin.email ?? null,
  });
  return NextResponse.json({ ok: true });
}
