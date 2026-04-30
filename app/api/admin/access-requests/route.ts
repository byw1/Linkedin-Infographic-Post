export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Admin-only list of submitted access requests. Pending first
// (descending by createdAt so newest is on top), then everything
// else also descending — keeps the surface useful for both
// triage and history.
export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const rows = await prisma.accessRequest.findMany({
    orderBy: [
      // Pending sorts first: enum ordering is alphabetic, so nudge
      // it manually with a status-priority case in JS instead of
      // relying on Postgres enum order.
      { createdAt: "desc" },
    ],
    include: {
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
    take: 200,
  });

  // JS-side ordering: pending → declined → approved, then by
  // createdAt desc inside each bucket.
  const order: Record<typeof rows[number]["status"], number> = {
    pending: 0,
    declined: 1,
    approved: 2,
  };
  const sorted = rows.sort((a, b) => {
    if (a.status !== b.status) return order[a.status] - order[b.status];
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return NextResponse.json({ requests: sorted });
}
