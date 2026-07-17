"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** One member row flattened for export (all human-useful fields). */
export type ExportRow = {
  member_type: string;
  identifier: string;
  first_name: string;
  last_name: string;
  class: string;
  section: string;
  academic_year: string;
  branch: string;
  roll_no: string;
  designation: string;
  department: string;
  dob: string;
  gender: string;
  blood_group: string;
  guardian_name: string;
  guardian_phone: string;
  phone: string;
  email: string;
  address: string;
  status: string;
  id_status: string;
  photo_url: string;
};

type Raw = {
  member_type: string | null;
  identifier: string | null;
  first_name: string | null;
  last_name: string | null;
  roll_no: string | null;
  designation: string | null;
  department: string | null;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string | null;
  pipeline_status: string | null;
  photo_url: string | null;
  classes: { name: string | null; section: string | null } | null;
  academic_years: { name: string | null } | null;
  branches: { name: string | null } | null;
};

const s = (v: string | null | undefined): string => v ?? "";

/**
 * Return the caller school's members for export, flattened. RLS scopes rows to
 * the caller's school. Pass `ids` to export only the selected members; omit for
 * all. Photos are returned as public URLs (fetched client-side for the ZIP).
 */
export async function getMembersForExport(ids?: string[]): Promise<ExportRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("members")
    .select(
      "member_type,identifier,first_name,last_name,roll_no,designation,department,dob,gender,blood_group,guardian_name,guardian_phone,phone,email,address,status,pipeline_status,photo_url,classes(name,section),academic_years(name),branches(name)",
    )
    .order("created_at", { ascending: true })
    .limit(20000);
  if (ids && ids.length > 0) query = query.in("id", ids);

  const { data, error } = await query;
  if (error) return [];
  const rows = (data ?? []) as unknown as Raw[];

  return rows.map((m) => ({
    member_type: s(m.member_type),
    identifier: s(m.identifier),
    first_name: s(m.first_name),
    last_name: s(m.last_name),
    class: s(m.classes?.name),
    section: s(m.classes?.section),
    academic_year: s(m.academic_years?.name),
    branch: s(m.branches?.name),
    roll_no: s(m.roll_no),
    designation: s(m.designation),
    department: s(m.department),
    dob: s(m.dob),
    gender: s(m.gender),
    blood_group: s(m.blood_group),
    guardian_name: s(m.guardian_name),
    guardian_phone: s(m.guardian_phone),
    phone: s(m.phone),
    email: s(m.email),
    address: s(m.address),
    status: s(m.status),
    id_status: s(m.pipeline_status),
    photo_url: s(m.photo_url),
  }));
}
