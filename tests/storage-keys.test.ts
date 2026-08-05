import { describe, expect, it } from "vitest";
import { extractKeyFromUrl } from "@/lib/storage";
import type { StorageSettings } from "@/lib/settings";

// The bucket we're migrating *to*. extractKeyFromUrl is given this, and
// has to recover keys from rows written against the old bucket too.
const NEW_BUCKET: StorageSettings = {
  endpoint: "https://new-endpoint.railway.app",
  bucket: "new-bucket",
  accessKey: "k",
  secretKey: "s",
  region: "auto",
  publicUrl: "",
  forcePathStyle: true,
};

const OLD = "https://old-endpoint.railway.app/old-bucket";

// One key per prefix uploadFile is called with, so a new prefix added at a
// call site without updating KEY_PREFIXES fails here.
const KEYS = [
  "logos/user-1/acme-abc123.png",
  "renders/user-1/render-abc123.png",
  "avatars/user-1-abc123.png",
  "tools/tool-1-abc123.png",
  "skills/skill-1.md",
];

describe("extractKeyFromUrl", () => {
  it("recovers keys from the current bucket's canonical URLs", () => {
    for (const key of KEYS) {
      const url = `${NEW_BUCKET.endpoint}/${NEW_BUCKET.bucket}/${key}`;
      expect(extractKeyFromUrl(url, NEW_BUCKET)).toBe(key);
    }
  });

  it("recovers keys from a previous bucket's URLs after migration", () => {
    for (const key of KEYS) {
      expect(extractKeyFromUrl(`${OLD}/${key}`, NEW_BUCKET)).toBe(key);
    }
  });

  it("recovers keys from the /api/files proxy path", () => {
    for (const key of KEYS) {
      expect(extractKeyFromUrl(`/api/files/${key}`, NEW_BUCKET)).toBe(key);
    }
  });

  it("ignores query strings on presigned URLs", () => {
    const key = "renders/user-1/render-abc123.png";
    const url = `${OLD}/${key}?X-Amz-Signature=deadbeef&X-Amz-Expires=3600`;
    expect(extractKeyFromUrl(url, NEW_BUCKET)).toBe(key);
  });

  it("returns null for a URL with no recognisable key", () => {
    expect(extractKeyFromUrl("https://example.com/favicon.ico", NEW_BUCKET)).toBeNull();
  });
});
