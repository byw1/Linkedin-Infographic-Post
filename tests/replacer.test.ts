import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { replaceEntities } from "@/lib/replacer";

const html = `
<section>
  <div data-entity="tesla" style="width:64px;height:64px;border-radius:8px;margin-bottom:12px;flex-shrink:0;background:#0f0;"></div>
  <div data-entity="elon-musk" style="width:48px;height:48px;border-radius:50%;background:#0f0;"></div>
  <div data-entity="unmapped" style="width:32px;height:32px;background:#0f0;"></div>
</section>
`;

const mapping = {
  tesla: "https://cdn.example.com/tesla.png",
  "elon-musk": "https://cdn.example.com/elon.png",
};

describe("replaceEntities", () => {
  it("replaces matched placeholders with <img> tags pointing at the mapped URL", () => {
    const out = replaceEntities(html, mapping);
    const $ = cheerio.load(out);
    const tesla = $('img[alt="tesla"]');
    expect(tesla.length).toBe(1);
    expect(tesla.attr("src")).toBe("https://cdn.example.com/tesla.png");
  });

  it("preserves the original size and border-radius on the new <img>", () => {
    const out = replaceEntities(html, mapping);
    const $ = cheerio.load(out);
    const style = $('img[alt="tesla"]').attr("style") ?? "";
    expect(style).toContain("width:64px");
    expect(style).toContain("height:64px");
    expect(style).toContain("border-radius:8px");
    expect(style).toContain("margin-bottom:12px");
    expect(style).toContain("flex-shrink:0");
    expect(style).toContain("object-fit:cover");
  });

  it("keeps circular shapes when border-radius:50%", () => {
    const out = replaceEntities(html, mapping);
    const $ = cheerio.load(out);
    expect($('img[alt="elon-musk"]').attr("style")).toContain("border-radius:50%");
  });

  it("leaves unmapped placeholders untouched", () => {
    const out = replaceEntities(html, mapping);
    const $ = cheerio.load(out);
    expect($('div[data-entity="unmapped"]').length).toBe(1);
    expect($('img[alt="unmapped"]').length).toBe(0);
  });

  it("returns input unchanged when mapping is empty", () => {
    const out = replaceEntities(html, {});
    const $ = cheerio.load(out);
    expect($("[data-entity]").length).toBe(3);
    expect($("img").length).toBe(0);
  });

  it("preserves the data-entity attribute on the rendered <img>", () => {
    const out = replaceEntities(html, mapping);
    const $ = cheerio.load(out);
    expect($('img[data-entity="tesla"]').length).toBe(1);
  });

  it("copies the class attribute so CSS-based sizing still applies", () => {
    const classed = `<div data-entity="alex" class="host-circle"></div>`;
    const out = replaceEntities(classed, { alex: "https://cdn.example.com/alex.png" });
    const $ = cheerio.load(out);
    expect($("img.host-circle").length).toBe(1);
    expect($("img").attr("class")).toBe("host-circle");
  });

  it("always emits display:block and background:#fff in inline style", () => {
    const out = replaceEntities(html, mapping);
    const $ = cheerio.load(out);
    const style = $('img[alt="tesla"]').attr("style") ?? "";
    expect(style).toContain("display:block");
    expect(style).toContain("background:#fff");
  });
});
