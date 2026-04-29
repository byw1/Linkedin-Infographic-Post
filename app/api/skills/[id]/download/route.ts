export const dynamic = "force-dynamic";

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fetchThemeForUser, tokensAsSkillBlock } from "@/lib/themes";

// Skill markdown download with optional theme injection. The base
// content comes from S3 (same bytes /api/files/<storageKey> would
// serve); when ?themeId=... is present and the caller can see that
// theme, we append the theme's tokens block at the end so Claude
// sees both the skill instructions and the brand tokens in one
// download.
//
// Why a separate route from /api/files: the proxy doesn't know
// anything about themes, and we don't want to modify the stored
// skill bytes — different members may pick different themes.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const skill = await prisma.skill.findUnique({ where: { id: params.id } });
  if (!skill) return new Response("Not found", { status: 404 });

  const { storage } = await getSettings();
  if (!storage) return new Response("Storage not configured", { status: 503 });

  const client = new S3Client({
    region: storage.region,
    endpoint: storage.endpoint,
    forcePathStyle: storage.forcePathStyle,
    credentials: {
      accessKeyId: storage.accessKey,
      secretAccessKey: storage.secretKey,
    },
  });

  let baseText: string;
  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: storage.bucket, Key: skill.storageKey }),
    );
    if (!result.Body) return new Response("Not found", { status: 404 });
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as unknown as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    baseText = Buffer.concat(chunks).toString("utf-8");
  } catch (err) {
    console.error(`[skills] download ${skill.id} failed`, err);
    return new Response("Storage error", { status: 502 });
  }

  const url = new URL(req.url);
  const themeId = url.searchParams.get("themeId");
  let body = baseText;
  let suffix = "";
  if (themeId) {
    const theme = await fetchThemeForUser(themeId, user);
    if (theme) {
      body = `${baseText.replace(/\s+$/, "")}\n${tokensAsSkillBlock(theme)}`;
      // Tag the filename so the user can tell themed copies apart from
      // the raw skill — purely cosmetic, the contents are what matters.
      suffix = `.${theme.name.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 32)}`;
    }
  }

  const filename = skill.filename.replace(/\.(md|markdown)$/i, "");
  const downloadName = `${filename}${suffix}.md`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
