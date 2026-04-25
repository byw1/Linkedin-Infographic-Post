import { NextResponse } from "next/server";
import { z } from "zod";
import { InviteError, redeemInvite } from "@/lib/invites";
import { WeakPasswordError } from "@/lib/passwords";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().max(80).optional(),
});

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const user = await redeemInvite({
      token: params.token,
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
    });
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    if (err instanceof InviteError) {
      const status =
        err.code === "not_found"
          ? 404
          : err.code === "expired" || err.code === "used"
            ? 410
            : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    if (err instanceof WeakPasswordError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
