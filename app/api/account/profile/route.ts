export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const Body = z.object({
  name: z.string().trim().min(1).max(80).nullable().optional(),
});

export async function PATCH(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name ?? null },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ user: updated });
}
