export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Aggregate of every tag currently in use across member profiles.
// Powers the tag-suggestion popover on the profile editor so members
// reuse existing tags ("fintech") instead of inventing parallels
// ("Fintech", "fin-tech", "FinTech"). Auth-gated; banned-author tags
// are excluded since those rows are hidden everywhere else too.
export async function GET() {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  const rows = await prisma.user.findMany({
    where: { bannedAt: null },
    select: { tags: true },
  });

  const set = new Set<string>();
  for (const r of rows) for (const t of r.tags) set.add(t);
  const tags = Array.from(set).sort();

  return NextResponse.json({ tags });
}
