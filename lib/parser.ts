import * as cheerio from "cheerio";
import crypto from "node:crypto";

export interface ExtractedEntity {
  slug: string;
  count: number;
  shape_hint: "square" | "circle";
  size_hint: number;
}

export function hashHtml(html: string): string {
  return crypto.createHash("sha256").update(html).digest("hex").slice(0, 16);
}

export function extractEntities(html: string): ExtractedEntity[] {
  const $ = cheerio.load(html);
  const entities = new Map<string, ExtractedEntity>();

  $("[data-entity]").each((_, el) => {
    const slug = $(el).attr("data-entity");
    if (!slug) return;
    if (slug.startsWith("unknown")) return;

    const style = $(el).attr("style") ?? "";
    const borderRadius = parseStyleValue(style, "border-radius");
    const width = parseStyleValue(style, "width");

    const shape_hint: ExtractedEntity["shape_hint"] =
      borderRadius === "50%" ? "circle" : "square";
    const size_hint = parsePx(width) || 44;

    const existing = entities.get(slug);
    if (existing) {
      existing.count += 1;
    } else {
      entities.set(slug, { slug, count: 1, shape_hint, size_hint });
    }
  });

  return Array.from(entities.values()).sort((a, b) => b.count - a.count);
}

function parseStyleValue(style: string, property: string): string | null {
  const match = style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"));
  return match ? match[1].trim() : null;
}

function parsePx(value: string | null): number {
  if (!value) return 0;
  const n = parseInt(value.replace("px", ""), 10);
  return Number.isFinite(n) ? n : 0;
}
