import { describe, expect, it } from "vitest";
import { parseScanCode } from "@/lib/scan";

const TOKEN = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

describe("parseScanCode", () => {
  it("extracts the token from a card QR verify URL", () => {
    expect(
      parseScanCode(`https://nxt-schools-id-card.vercel.app/verify/${TOKEN}`),
    ).toEqual({ kind: "token", value: TOKEN });
  });

  it("handles verify URLs with query strings and localhost origins", () => {
    expect(parseScanCode(`http://localhost:3000/verify/${TOKEN}?src=qr`)).toEqual({
      kind: "token",
      value: TOKEN,
    });
  });

  it("treats a bare UUID as a token and lowercases it", () => {
    expect(parseScanCode(TOKEN.toUpperCase())).toEqual({ kind: "token", value: TOKEN });
  });

  it("treats an admission number (Code128 barcode) as an identifier", () => {
    expect(parseScanCode("NXT-2025-001")).toEqual({
      kind: "identifier",
      value: "NXT-2025-001",
    });
  });

  it("trims scanner padding but preserves the identifier itself", () => {
    expect(parseScanCode("  EMP-001  \n")).toEqual({ kind: "identifier", value: "EMP-001" });
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(parseScanCode("")).toBeNull();
    expect(parseScanCode("   ")).toBeNull();
  });
});
