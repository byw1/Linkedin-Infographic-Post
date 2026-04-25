export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createInvite } from "@/lib/invites";

const Body = z.object({
  email: z.string().email().optional(),
  role: z.enum(["user", "admin"]).default("user"),
  note: z.string().trim().max(200).optional(),
  ttlDays: z.number().int().positive().max(90).optional(),
});

export async function GET() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const invites = await prisma.invite.findMany({
    where: { createdById: admin.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ invites });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const invite = await createInvite({
    createdById: admin.id,
    email: parsed.data.email ?? null,
    role: parsed.data.role,
    note: parsed.data.note ?? null,
    ttlDays: parsed.data.ttlDays,
  });
  return NextResponse.json({ invite });
}
