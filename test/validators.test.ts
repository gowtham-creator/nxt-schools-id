import { describe, expect, it } from "vitest";
import {
  academicYearSchema,
  formToObject,
  memberSchema,
} from "@/lib/validators";

describe("memberSchema", () => {
  const minimal = { first_name: "Asha" };

  it("parses a minimal input and applies defaults", () => {
    const parsed = memberSchema.parse(minimal);
    expect(parsed.first_name).toBe("Asha");
    expect(parsed.member_type).toBe("student");
    expect(parsed.status).toBe("active");
  });

  it("preprocesses empty strings to null on optional fields", () => {
    const parsed = memberSchema.parse({
      ...minimal,
      identifier: "",
      last_name: "",
      email: "",
      dob: "",
      photo_url: "",
      guardian_phone: "",
      address: "",
    });
    expect(parsed.identifier).toBeNull();
    expect(parsed.last_name).toBeNull();
    expect(parsed.email).toBeNull();
    expect(parsed.dob).toBeNull();
    expect(parsed.photo_url).toBeNull();
    expect(parsed.guardian_phone).toBeNull();
    expect(parsed.address).toBeNull();
  });

  it("treats absent optional fields as null", () => {
    const parsed = memberSchema.parse(minimal);
    expect(parsed.identifier).toBeNull();
    expect(parsed.email).toBeNull();
    expect(parsed.class_id).toBeNull();
    expect(parsed.dob).toBeNull();
  });

  it("rejects an invalid email but keeps a valid one", () => {
    const bad = memberSchema.safeParse({ ...minimal, email: "not-an-email" });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.path[0] === "email")).toBe(true);
    }

    const good = memberSchema.parse({ ...minimal, email: "asha@example.com" });
    expect(good.email).toBe("asha@example.com");
  });

  it("requires dob to match YYYY-MM-DD", () => {
    expect(memberSchema.parse({ ...minimal, dob: "2012-04-15" }).dob).toBe(
      "2012-04-15",
    );
    expect(
      memberSchema.safeParse({ ...minimal, dob: "15-04-2012" }).success,
    ).toBe(false);
    expect(
      memberSchema.safeParse({ ...minimal, dob: "2012/04/15" }).success,
    ).toBe(false);
    expect(memberSchema.safeParse({ ...minimal, dob: "2012-4-5" }).success).toBe(
      false,
    );
  });

  it("defaults status to active, keeps explicit values, rejects unknown ones", () => {
    expect(memberSchema.parse(minimal).status).toBe("active");
    expect(memberSchema.parse({ ...minimal, status: "archived" }).status).toBe(
      "archived",
    );
    expect(
      memberSchema.safeParse({ ...minimal, status: "deleted" }).success,
    ).toBe(false);
  });

  it("rejects a missing or empty first_name", () => {
    expect(memberSchema.safeParse({}).success).toBe(false);
    expect(memberSchema.safeParse({ first_name: "" }).success).toBe(false);
  });
});

describe("academicYearSchema", () => {
  const minimal = { name: "2025-26" };

  it('coerces is_current "on" (checkbox) and true to true', () => {
    expect(
      academicYearSchema.parse({ ...minimal, is_current: "on" }).is_current,
    ).toBe(true);
    expect(
      academicYearSchema.parse({ ...minimal, is_current: true }).is_current,
    ).toBe(true);
    expect(
      academicYearSchema.parse({ ...minimal, is_current: "true" }).is_current,
    ).toBe(true);
  });

  it("coerces an absent checkbox (undefined) to false", () => {
    expect(academicYearSchema.parse(minimal).is_current).toBe(false);
  });

  it("coerces any other value to false", () => {
    expect(
      academicYearSchema.parse({ ...minimal, is_current: "off" }).is_current,
    ).toBe(false);
  });

  it("turns empty date strings into null and validates the format", () => {
    const parsed = academicYearSchema.parse({
      ...minimal,
      start_date: "",
      end_date: "2026-05-31",
    });
    expect(parsed.start_date).toBeNull();
    expect(parsed.end_date).toBe("2026-05-31");
    expect(
      academicYearSchema.safeParse({ ...minimal, start_date: "31-05-2026" })
        .success,
    ).toBe(false);
  });
});

describe("formToObject", () => {
  it("builds a plain object from FormData string entries", () => {
    const fd = new FormData();
    fd.append("first_name", "Asha");
    fd.append("email", "");
    expect(formToObject(fd)).toEqual({ first_name: "Asha", email: "" });
  });

  it("keeps the last value for duplicate keys and skips non-string entries", () => {
    const fd = new FormData();
    fd.append("dup", "one");
    fd.append("dup", "two");
    fd.append("photo", new Blob(["x"], { type: "text/plain" }), "x.txt");
    expect(formToObject(fd)).toEqual({ dup: "two" });
  });

  it("feeds memberSchema so empty form inputs become null", () => {
    const fd = new FormData();
    fd.append("first_name", "Asha");
    fd.append("email", "");
    fd.append("dob", "");
    const parsed = memberSchema.parse(formToObject(fd));
    expect(parsed.email).toBeNull();
    expect(parsed.dob).toBeNull();
  });
});
