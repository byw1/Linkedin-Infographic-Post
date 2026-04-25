export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshUrl } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const render = await prisma.render.findUnique({ where: { id: params.id } });
  if (!render || render.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const png_url = render.pngUrl ? ((await refreshUrl(render.pngUrl)) ?? render.pngUrl) : null;

  return NextResponse.json({
    id: render.id,
    status: render.status,
    png_url,
    error_message: render.errorMessage,
  });
}
