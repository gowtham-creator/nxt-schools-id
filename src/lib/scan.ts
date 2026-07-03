// Scan-station shared types + pure code parsing. Client- and server-safe
// (no server-only import) so the same parser drives the camera loop, USB
// scanner input, and the server action — and stays unit-testable.

import type { MemberStatus, MemberType, PipelineStatus } from "@/lib/types";

/** What a scanned string was recognised as. */
export interface ScanParse {
  /** "token" = card QR (verify URL or bare qr_token); "identifier" = barcode / admission no. */
  kind: "token" | "identifier";
  value: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERIFY_RE = /\/verify\/([0-9a-f-]{36})/i;

/**
 * Classify a raw scanned string.
 * - Card QR encodes `{APP_URL}/verify/{qr_token}` → token
 * - A bare UUID (e.g. pasted token) → token
 * - Card barcode encodes the admission no (Code128) → identifier
 * Returns null for empty input.
 */
export function parseScanCode(raw: string): ScanParse | null {
  const s = raw.trim();
  if (!s) return null;

  const verify = VERIFY_RE.exec(s);
  if (verify) return { kind: "token", value: verify[1].toLowerCase() };

  if (UUID_RE.test(s)) return { kind: "token", value: s.toLowerCase() };

  return { kind: "identifier", value: s };
}

/** PII-light, serializable member payload shown at the scan station. */
export interface ScannedMember {
  id: string;
  full_name: string;
  member_type: MemberType;
  identifier: string | null;
  photo_url: string | null;
  status: MemberStatus;
  pipeline_status: PipelineStatus;
  blood_group: string | null;
  valid_until: string | null;
  class_name: string | null;
  section: string | null;
  branch: string | null;
}

export type ScanResult =
  | { ok: true; member: ScannedMember; via: ScanParse["kind"] }
  | { ok: false; error: string };
