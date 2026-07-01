import { describe, expect, it } from "vitest";
import { resolveSide } from "@/lib/card/resolve";
import type {
  Member,
  School,
  TemplateElement,
  TemplateSide,
} from "@/lib/types";

/** Fully-populated Member row; override per test. */
function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: "m-1",
    school_id: "s-1",
    member_type: "student",
    identifier: "STU-001",
    first_name: "Asha",
    last_name: "Rao",
    photo_url: "https://cdn.example.com/photos/asha.jpg",
    dob: "2012-04-15",
    gender: "female",
    blood_group: "O+",
    class_id: "c-1",
    roll_no: "17",
    designation: null,
    department: null,
    guardian_name: "Ravi Rao",
    guardian_phone: "+91 9000000000",
    phone: null,
    email: null,
    address: null,
    valid_from: "2025-06-01",
    valid_until: "2026-05-31",
    status: "active",
    qr_token: "tok-abc123",
    branch_id: null,
    template_id: null,
    academic_year_id: null,
    pipeline_status: "not_generated",
    card_pdf_url: null,
    card_generated_at: null,
    bg_removed: false,
    extra: {},
    created_at: "2025-06-01T00:00:00Z",
    updated_at: "2025-06-01T00:00:00Z",
    ...overrides,
  };
}

function makeEl(
  overrides: Partial<TemplateElement> & Pick<TemplateElement, "id" | "type">,
): TemplateElement {
  return { x: 5, y: 5, w: 30, h: 10, ...overrides };
}

function makeSide(
  elements: TemplateElement[],
  background: string | null = null,
): TemplateSide {
  return { background, elements };
}

const school: Partial<School> = {
  name: "Nxt Public School",
  logo_url: "https://cdn.example.com/logo.png",
};

const classRow = { name: "5", section: "B" };

describe("resolveSide", () => {
  it("resolves full_name as first + last joined with a space", async () => {
    const side = makeSide([makeEl({ id: "f1", type: "field", field: "full_name" })]);
    const data = await resolveSide(side, makeMember(), classRow, school);
    expect(data.f1).toBe("Asha Rao");
  });

  it("resolves full_name as first name only when last_name is null", async () => {
    const side = makeSide([makeEl({ id: "f1", type: "field", field: "full_name" })]);
    const data = await resolveSide(
      side,
      makeMember({ last_name: null }),
      classRow,
      school,
    );
    expect(data.f1).toBe("Asha");
  });

  it("resolves class_name and section from the class row", async () => {
    const side = makeSide([
      makeEl({ id: "cls", type: "field", field: "class_name" }),
      makeEl({ id: "sec", type: "field", field: "section" }),
    ]);
    const data = await resolveSide(side, makeMember(), classRow, school);
    expect(data.cls).toBe("5");
    expect(data.sec).toBe("B");
  });

  it('resolves class_name and section to "" when the class row is null', async () => {
    const side = makeSide([
      makeEl({ id: "cls", type: "field", field: "class_name" }),
      makeEl({ id: "sec", type: "field", field: "section" }),
    ]);
    const data = await resolveSide(side, makeMember(), null, school);
    expect(data.cls).toBe("");
    expect(data.sec).toBe("");
  });

  it("resolves text elements to their literal text", async () => {
    const side = makeSide([makeEl({ id: "t1", type: "text", text: "IDENTITY CARD" })]);
    const data = await resolveSide(side, makeMember(), classRow, school);
    expect(data.t1).toBe("IDENTITY CARD");
  });

  it('resolves image src="photo_url" to the member photo and "logo" to the school logo', async () => {
    const side = makeSide([
      makeEl({ id: "photo", type: "image", src: "photo_url" }),
      makeEl({ id: "logo", type: "image", src: "logo" }),
      makeEl({ id: "static", type: "image", src: "https://cdn.example.com/frame.png" }),
    ]);
    const data = await resolveSide(side, makeMember(), classRow, school);
    expect(data.photo).toBe("https://cdn.example.com/photos/asha.jpg");
    expect(data.logo).toBe("https://cdn.example.com/logo.png");
    expect(data.static).toBe("https://cdn.example.com/frame.png");
  });

  it('resolves image bindings to "" when the bound url is null', async () => {
    const side = makeSide([makeEl({ id: "photo", type: "image", src: "photo_url" })]);
    const data = await resolveSide(
      side,
      makeMember({ photo_url: null }),
      classRow,
      school,
    );
    expect(data.photo).toBe("");
  });

  it('resolves a qr element bound to "qr_token" to a data:image URL', async () => {
    const side = makeSide([
      makeEl({ id: "q1", type: "qr", value: "qr_token", w: 15, h: 15 }),
    ]);
    const data = await resolveSide(side, makeMember(), classRow, school);
    expect(data.q1.startsWith("data:image")).toBe(true);
  });

  it("resolves a barcode element to an SVG data URL built from member.identifier", async () => {
    const side = makeSide([makeEl({ id: "b1", type: "barcode", w: 30, h: 8 })]);
    const data = await resolveSide(side, makeMember(), classRow, school);
    const prefix = "data:image/svg+xml,";
    expect(data.b1.startsWith(prefix)).toBe(true);
    // The payload is a real SVG document (bwip-js draws the human-readable
    // text as vector paths, so the identifier is not literal text).
    const svg = decodeURIComponent(data.b1.slice(prefix.length));
    expect(svg).toMatch(/^<svg[\s>]/);
  });

  it('resolves a barcode to "" when the member has no identifier', async () => {
    const side = makeSide([makeEl({ id: "b1", type: "barcode", w: 30, h: 8 })]);
    const data = await resolveSide(
      side,
      makeMember({ identifier: null }),
      classRow,
      school,
    );
    expect(data.b1).toBe("");
  });

  it("copies side.background into the returned map (and omits it when null)", async () => {
    const withBg = await resolveSide(
      makeSide([], "#0f766e"),
      makeMember(),
      classRow,
      school,
    );
    expect(withBg.background).toBe("#0f766e");

    const noBg = await resolveSide(makeSide([]), makeMember(), classRow, school);
    expect("background" in noBg).toBe(false);
  });
});
