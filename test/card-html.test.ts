import { describe, expect, it } from "vitest";
import { cardSideToHtml } from "@/lib/render/card-html";
import type { TemplateElement, TemplateSide } from "@/lib/types";

/** Element fixture: sensible mm geometry, caller supplies id/type (+ overrides). */
function makeEl(
  overrides: Partial<TemplateElement> & Pick<TemplateElement, "id" | "type">,
): TemplateElement {
  return { x: 10, y: 5, w: 40, h: 10, ...overrides };
}

function makeSide(
  elements: TemplateElement[],
  background: string | null = null,
): TemplateSide {
  return { background, elements };
}

const W = 100; // mm
const H = 50; // mm
const SCALE = 2; // px per mm

describe("cardSideToHtml", () => {
  it("HTML-escapes text values", () => {
    const el = makeEl({
      id: "t1",
      type: "text",
      text: '<script>alert("x")</script>',
    });
    const html = cardSideToHtml(makeSide([el]), {}, W, H, SCALE);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;x&quot;");
    expect(html).not.toContain("<script>");
  });

  it("HTML-escapes resolved data values keyed by element id", () => {
    const el = makeEl({ id: "f1", type: "field", field: "full_name" });
    const html = cardSideToHtml(
      makeSide([el]),
      { f1: "<b>Asha & Co</b>" },
      W,
      H,
      SCALE,
    );
    expect(html).toContain("&lt;b&gt;Asha &amp; Co&lt;/b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("emits a data-el-id attribute for every rendered element", () => {
    const els = [
      makeEl({ id: "t1", type: "text", text: "Hello" }),
      makeEl({ id: "r1", type: "rect", fill: "#0f766e" }),
      makeEl({ id: "i1", type: "image", src: "https://cdn.example.com/a.png" }),
    ];
    const html = cardSideToHtml(makeSide(els), {}, W, H, SCALE);
    expect(html).toContain('data-el-id="t1"');
    expect(html).toContain('data-el-id="r1"');
    expect(html).toContain('data-el-id="i1"');
  });

  it("positions elements in px = mm * scale", () => {
    const el = makeEl({ id: "t1", type: "text", text: "Hi", x: 10, y: 5, w: 40, h: 10 });
    const html = cardSideToHtml(makeSide([el]), {}, W, H, SCALE);
    expect(html).toContain("left:20px");
    expect(html).toContain("top:10px");
    expect(html).toContain("width:80px");
    expect(html).toContain("height:20px");

    const html3 = cardSideToHtml(makeSide([el]), {}, W, H, 3);
    expect(html3).toContain("left:30px");
    expect(html3).toContain("top:15px");
  });

  it("sizes the root to the card dimensions at the given scale", () => {
    const html = cardSideToHtml(makeSide([]), {}, W, H, SCALE);
    expect(html).toContain('data-card-side=""');
    expect(html).toContain("width:200px");
    expect(html).toContain("height:100px");
  });

  it("skips hidden elements when renderHidden=false but renders them when true", () => {
    const el = makeEl({ id: "h1", type: "text", text: "Hidden", hidden: true });
    const side = makeSide([el]);

    const hiddenOff = cardSideToHtml(side, {}, W, H, SCALE, false);
    expect(hiddenOff).not.toContain('data-el-id="h1"');

    const hiddenOn = cardSideToHtml(side, {}, W, H, SCALE, true);
    expect(hiddenOn).toContain('data-el-id="h1"');

    // renderHidden defaults to true (print shows editor-hidden layers).
    const defaulted = cardSideToHtml(side, {}, W, H, SCALE);
    expect(defaulted).toContain('data-el-id="h1"');
  });

  it("renders a colour background as background-color", () => {
    const html = cardSideToHtml(makeSide([], "#0f766e"), {}, W, H, SCALE);
    expect(html).toContain("background-color:#0f766e");
    expect(html).not.toContain("background-image");
  });

  it("renders an image-url background as background-image with cover sizing", () => {
    const html = cardSideToHtml(
      makeSide([], "https://cdn.example.com/bg.png"),
      {},
      W,
      H,
      SCALE,
    );
    expect(html).toContain(
      'background-image:url("https://cdn.example.com/bg.png")',
    );
    expect(html).toContain("background-size:cover");
  });

  it("lets data.background override the side background", () => {
    const html = cardSideToHtml(
      makeSide([], "#000000"),
      { background: "#123456" },
      W,
      H,
      SCALE,
    );
    expect(html).toContain("background-color:#123456");
    expect(html).not.toContain("background-color:#000000");
  });

  it("gives qr elements a white backing with 0.5mm padding and the resolved src", () => {
    const el = makeEl({ id: "q1", type: "qr", value: "qr_token", w: 10, h: 10 });
    const html = cardSideToHtml(
      makeSide([el]),
      { q1: "data:image/png;base64,AAA" },
      W,
      H,
      SCALE,
    );
    expect(html).toContain("background-color:#ffffff");
    expect(html).toContain("padding:1px"); // 0.5mm * scale 2
    expect(html).toContain('<img src="data:image/png;base64,AAA"');
  });

  it("gives barcode elements the same white backing even without a resolved value", () => {
    const el = makeEl({ id: "b1", type: "barcode", w: 30, h: 8 });
    const html = cardSideToHtml(makeSide([el]), {}, W, H, SCALE);
    expect(html).toContain('data-el-id="b1"');
    expect(html).toContain("background-color:#ffffff");
    expect(html).not.toContain("<img");
  });
});
