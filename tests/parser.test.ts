import { describe, expect, it } from "vitest";
import { extractEntities, hashHtml } from "@/lib/parser";

const html = `
<div>
  <div data-entity="tesla" style="width:64px;height:64px;border-radius:8px;background:#0f0;"></div>
  <div data-entity="elon-musk" style="width:48px;height:48px;border-radius:50%;background:#0f0;"></div>
  <div data-entity="tesla" style="width:64px;height:64px;border-radius:8px;background:#0f0;"></div>
  <div data-entity="unknown-1" style="width:44px;height:44px;background:#0f0;"></div>
  <span data-entity="waymo" style="width:32px;height:32px;border-radius:50%;"></span>
</div>
`;

describe("extractEntities", () => {
  it("groups duplicate slugs and counts occurrences", () => {
    const result = extractEntities(html);
    const tesla = result.find((e) => e.slug === "tesla");
    expect(tesla?.count).toBe(2);
  });

  it("skips slugs starting with 'unknown'", () => {
    const result = extractEntities(html);
    expect(result.find((e) => e.slug === "unknown-1")).toBeUndefined();
  });

  it("detects circular shape from border-radius:50%", () => {
    const result = extractEntities(html);
    expect(result.find((e) => e.slug === "elon-musk")?.shape_hint).toBe("circle");
    expect(result.find((e) => e.slug === "waymo")?.shape_hint).toBe("circle");
  });

  it("detects square shape when border-radius is not 50%", () => {
    const result = extractEntities(html);
    expect(result.find((e) => e.slug === "tesla")?.shape_hint).toBe("square");
  });

  it("captures size hint from width", () => {
    const result = extractEntities(html);
    expect(result.find((e) => e.slug === "tesla")?.size_hint).toBe(64);
    expect(result.find((e) => e.slug === "elon-musk")?.size_hint).toBe(48);
  });

  it("falls back to default size when width is missing", () => {
    const result = extractEntities(`<div data-entity="x"></div>`);
    expect(result[0].size_hint).toBe(44);
  });

  it("sorts results by count descending", () => {
    const result = extractEntities(html);
    expect(result[0].slug).toBe("tesla");
  });

  it("returns an empty list when no entities are found", () => {
    expect(extractEntities("<div>no entities here</div>")).toEqual([]);
  });
});

describe("hashHtml", () => {
  it("returns a 16-char stable hash", () => {
    const a = hashHtml("hello world");
    const b = hashHtml("hello world");
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it("returns different hashes for different input", () => {
    expect(hashHtml("a")).not.toBe(hashHtml("b"));
  });
});
