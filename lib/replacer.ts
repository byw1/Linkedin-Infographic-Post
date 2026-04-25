import * as cheerio from "cheerio";

export interface EntityMapping {
  [slug: string]: string;
}

export function replaceEntities(html: string, mapping: EntityMapping): string {
  const $ = cheerio.load(html);

  $("[data-entity]").each((_, el) => {
    const slug = $(el).attr("data-entity");
    if (!slug) return;
    const url = mapping[slug];
    if (!url) return;

    const $el = $(el);
    const style = $el.attr("style") ?? "";

    const width = parseStyleValue(style, "width");
    const height = parseStyleValue(style, "height");
    const borderRadius = parseStyleValue(style, "border-radius");
    const margin = parseStyleValue(style, "margin-bottom");
    const flexShrink = parseStyleValue(style, "flex-shrink");

    const imgStyle = [
      width && `width:${width}`,
      height && `height:${height}`,
      borderRadius && `border-radius:${borderRadius}`,
      margin && `margin-bottom:${margin}`,
      flexShrink && `flex-shrink:${flexShrink}`,
      "object-fit:cover",
      "background:#fff",
    ]
      .filter(Boolean)
      .join(";");

    const $img = $("<img>")
      .attr("src", url)
      .attr("alt", slug)
      .attr("data-entity", slug)
      .attr("style", imgStyle);

    $el.replaceWith($img);
  });

  return $.html();
}

function parseStyleValue(style: string, property: string): string | null {
  const match = style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"));
  return match ? match[1].trim() : null;
}
