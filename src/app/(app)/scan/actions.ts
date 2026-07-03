"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { parseScanCode, type ScanResult, type ScannedMember } from "@/lib/scan";
import type { MemberStatus, MemberType, PipelineStatus } from "@/lib/types";

/** Row shape for the scan lookup (PostgREST many-to-one joins come back as objects). */
type ScanRow = {
  id: string;
  member_type: MemberType;
  identifier: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  status: MemberStatus;
  pipeline_status: PipelineStatus;
  blood_group: string | null;
  valid_until: string | null;
  classes: { name: string; section: string | null } | null;
  branches: { name: string } | null;
};

const SCAN_SELECT =
  "id,member_type,identifier,first_name,last_name,photo_url,status,pipeline_status,blood_group,valid_until,classes(name,section),branches(name)";

/**
 * Resolve a scanned code (card QR verify-URL / bare token / barcode admission
 * no) to the member it belongs to, and record a `card.scanned` audit event.
 * Works for every role — the gate/scan desk is typically run by operators.
 */
export async function scanLookup(raw: string): Promise<ScanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("app_users")
    .select("school_id")
    .eq("id", user.id)
    .maybeSingle();
  const schoolId: string | null = profile?.school_id ?? null;

  const parsed = parseScanCode(raw);
  if (!parsed) return { ok: false, error: "Nothing scanned — try again." };

  let q = supabase.from("members").select(SCAN_SELECT).limit(1);
  if (schoolId) q = q.eq("school_id", schoolId);
  q =
    parsed.kind === "token"
      ? q.eq("qr_token", parsed.value)
      : q.ilike("identifier", parsed.value);

  const { data, error } = await q.maybeSingle();
  if (error) return { ok: false, error: `Lookup failed: ${error.message}` };
  if (!data) {
    return {
      ok: false,
      error:
        parsed.kind === "token"
          ? "No student matches this card's QR code."
          : `No member found with ID “${parsed.value}”.`,
    };
  }

  const row = data as unknown as ScanRow;
  const member: ScannedMember = {
    id: row.id,
    full_name: [row.first_name, row.last_name].filter(Boolean).join(" "),
    member_type: row.member_type,
    identifier: row.identifier,
    photo_url: row.photo_url,
    status: row.status,
    pipeline_status: row.pipeline_status,
    blood_group: row.blood_group,
    valid_until: row.valid_until,
    class_name: row.classes?.name ?? null,
    section: row.classes?.section ?? null,
    branch: row.branches?.name ?? null,
  };

  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "card.scanned",
    targetType: "member",
    targetId: member.id,
    meta: { via: parsed.kind },
  });

  return { ok: true, member, via: parsed.kind };
}
