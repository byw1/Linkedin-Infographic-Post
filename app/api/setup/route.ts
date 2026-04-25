import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, WeakPasswordError } from "@/lib/passwords";
import { isFirstRun } from "@/lib/auth";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  if (!(await isFirstRun())) {
    return NextResponse.json({ error: "Setup already complete." }, { status: 409 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction to avoid a race with a second
      // first-run request landing in parallel.
      const count = await tx.user.count();
      if (count > 0) throw new Error("ALREADY_INITIALIZED");
      return tx.user.create({
        data: {
          email,
          name: parsed.data.name ?? null,
          passwordHash,
          role: "admin",
        },
      });
    });
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (error) {
    if (error instanceof WeakPasswordError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "ALREADY_INITIALIZED") {
      return NextResponse.json({ error: "Setup already complete." }, { status: 409 });
    }
    throw error;
  }
}
