export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshUrl } from "@/lib/storage";

// Member-facing list of admin-managed tools (LinkedIn automation,
// scheduling, analytics, etc). Auth-only — no public access. The
// /docs/tools page consumes this; admins use /api/admin/tools to
// edit.
export async function GET() {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  const rows = await prisma.tool.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  // Logos are stored as absolute URLs, so a row written against a previous
  // bucket keeps that bucket's address forever. Re-point them at the
  // current one on read.
  const tools = await Promise.all(
    rows.map(async (t) => ({
      ...t,
      logoUrl: t.logoUrl ? ((await refreshUrl(t.logoUrl)) ?? t.logoUrl) : null,
    })),
  );
  return NextResponse.json({ tools });
}
