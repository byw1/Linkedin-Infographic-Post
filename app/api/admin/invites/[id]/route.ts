export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const invite = await prisma.invite.findUnique({ where: { id: params.id } });
  if (!invite || invite.createdById !== admin.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invite.usedAt) {
    return NextResponse.json({ error: "Invite already used" }, { status: 409 });
  }
  await prisma.invite.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
