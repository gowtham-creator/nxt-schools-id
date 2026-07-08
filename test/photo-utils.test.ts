import { describe, it, expect } from "vitest";
import { versionedPublicUrl, photoPathFromUrl } from "@/app/(app)/members/photo-utils";

const BASE =
  "https://x.supabase.co/storage/v1/object/public/photos/school-1/member-9.jpg";

describe("versionedPublicUrl", () => {
  it("appends a cache-busting ?v= token so a replaced photo is never stale", () => {
    const url = versionedPublicUrl(BASE);
    expect(url.startsWith(`${BASE}?v=`)).toBe(true);
    expect(url).toMatch(/\?v=[0-9a-f]{8}$/);
  });

  it("produces a different URL on each call (uniqueness → cache miss)", () => {
    const a = versionedPublicUrl(BASE);
    const b = versionedPublicUrl(BASE);
    expect(a).not.toBe(b);
  });
});

describe("photoPathFromUrl", () => {
  it("extracts the bucket-relative object path", () => {
    expect(photoPathFromUrl(BASE)).toBe("school-1/member-9.jpg");
  });

  it("ignores the cache-busting query string when deriving the path", () => {
    expect(photoPathFromUrl(versionedPublicUrl(BASE))).toBe("school-1/member-9.jpg");
  });

  it("decodes percent-encoded segments", () => {
    const url =
      "https://x.supabase.co/storage/v1/object/public/photos/school%201/a%20b.jpg";
    expect(photoPathFromUrl(url)).toBe("school 1/a b.jpg");
  });

  it("returns null for empty, unrelated, or non-photos URLs", () => {
    expect(photoPathFromUrl(null)).toBeNull();
    expect(photoPathFromUrl(undefined)).toBeNull();
    expect(photoPathFromUrl("")).toBeNull();
    expect(photoPathFromUrl("https://example.com/foo.jpg")).toBeNull();
  });
});
