export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  const tools = await prisma.tool.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ tools });
}
