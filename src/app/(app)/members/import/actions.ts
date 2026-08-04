"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { memberSchema } from "@/lib/validators";
import { isSectionlessGrade, canonicalGrade } from "@/lib/constants";

type ImportRow = Record<string, string>;

export async function importMembers(
  rows: ImportRow[],
): Promise<{ inserted: number; updated: number; failed: number; errors: string[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("app_users")
    .select("school_id")
    .eq("id", user.id)
    .single();
  const schoolId = (profile?.school_id ?? null) as string | null;
  if (!schoolId) return { inserted: 0, updated: 0, failed: rows.length, errors: ["No school assigned to your account"] };
  if (!rows.length) return { inserted: 0, updated: 0, failed: 0, errors: ["No rows to import"] };

  // Resolve (class, section) -> class id (find or create), scoped to the school.
  // Uses the service role so classes can be created regardless of the caller's
  // INSERT rights; every query is scoped explicitly to schoolId.
  const admin = createAdminClient();
  const classKey = (name: string, section: string) =>
    `${name.trim().toLowerCase()}|${section.trim().toLowerCase()}`;
  const classMap = new Map<string, string>();
  const { data: existing } = await admin
    .from("classes")
    .select("id,name,section")
    .eq("school_id", schoolId);
  for (const c of existing ?? [])
    classMap.set(classKey(c.name ?? "", c.section ?? ""), c.id);
  // Nursery / UKG stay section-less on import too — drop any imported section.
  const effSection = (name: string, section: string) =>
    isSectionlessGrade(name) ? "" : section.trim();
  const wanted = new Map<string, { name: string; section: string }>();
  for (const r of rows) {
    const name = canonicalGrade(r.class ?? "");
    if (!name) continue;
    const sec = effSection(name, r.section ?? "");
    wanted.set(classKey(name, sec), { name, section: sec });
  }
  for (const { name, section } of wanted.values()) {
    const key = classKey(name, section);
    if (!classMap.has(key)) {
      const { data } = await admin
        .from("classes")
        .insert({ school_id: schoolId, name, section: section || null })
        .select("id")
        .single();
      if (data) classMap.set(key, data.id);
    }
  }

  // Resolve academic-year (batch) name -> id (find or create), scoped to school.
  const yearMap = new Map<string, string>();
  const { data: existingYears } = await admin
    .from("academic_years")
    .select("id,name")
    .eq("school_id", schoolId);
  for (const yr of existingYears ?? [])
    yearMap.set((yr.name ?? "").trim().toLowerCase(), yr.id as string);
  const wantedYears = new Set<string>();
  for (const r of rows) {
    const y = (r.academic_year ?? "").trim();
    if (y) wantedYears.add(y);
  }
  for (const y of wantedYears) {
    const key = y.toLowerCase();
    if (!yearMap.has(key)) {
      const { data } = await admin
        .from("academic_years")
        .insert({ school_id: schoolId, name: y, is_current: false })
        .select("id")
        .single();
      if (data) yearMap.set(key, data.id as string);
    }
  }

  // Words in a "type"/"role" column that mean staff (everything else = student).
  const STAFF_WORDS = new Set([
    "staff", "teacher", "teaching", "non-teaching", "employee", "faculty",
    "principal", "admin", "teaching staff", "non teaching staff",
  ]);

  const errors: string[] = [];
  const records: Record<string, unknown>[] = [];
  rows.forEach((r, i) => {
    const className = canonicalGrade(r.class ?? "");
    const yearName = (r.academic_year ?? "").trim();
    const candidate = {
      member_type: STAFF_WORDS.has((r.member_type ?? "").trim().toLowerCase()) ? "staff" : "student",
      identifier: r.identifier ?? "",
      first_name: r.first_name ?? "",
      last_name: r.last_name ?? "",
      class_id: className ? (classMap.get(classKey(className, effSection(className, r.section ?? ""))) ?? "") : "",
      academic_year_id: yearName ? (yearMap.get(yearName.toLowerCase()) ?? "") : "",
      roll_no: r.roll_no ?? "",
      dob: r.dob ?? "",
      gender: r.gender ?? "",
      blood_group: r.blood_group ?? "",
      guardian_name: r.guardian_name ?? "",
      guardian_phone: r.guardian_phone ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      address: r.address ?? "",
      status: "active",
      photo_url: "",
    };
    const parsed = memberSchema.safeParse(candidate);
    if (!parsed.success) errors.push(`Row ${i + 2}: ${parsed.error.issues[0].message}`);
    else records.push({ ...parsed.data, school_id: schoolId });
  });

  // ── Upsert: match each parsed row to an existing member so RE-IMPORTING
  //    corrected data UPDATES that student instead of creating a duplicate copy.
  //    Match by admission number when present, else by full name + date of birth.
  const normName = (fn: unknown, ln: unknown) =>
    `${String(fn ?? "").trim().toLowerCase().replace(/\s+/g, " ")} ${String(ln ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")}`.trim();

  const byId = new Map<string, string>();
  const byNameDob = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("members")
      .select("id,identifier,first_name,last_name,dob")
      .eq("school_id", schoolId)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const raw of data) {
      const m = raw as {
        id: string;
        identifier: string | null;
        first_name: string;
        last_name: string | null;
        dob: string | null;
      };
      const ident = (m.identifier ?? "").trim().toLowerCase();
      if (ident) byId.set(ident, m.id);
      if (m.dob) byNameDob.set(`${normName(m.first_name, m.last_name)}|${m.dob}`, m.id);
    }
    if (data.length < 1000) break;
  }

  const matchId = (rec: Record<string, unknown>): string | undefined => {
    const ident = String(rec.identifier ?? "").trim().toLowerCase();
    if (ident && byId.has(ident)) return byId.get(ident);
    const dob = rec.dob ? String(rec.dob) : "";
    return dob ? byNameDob.get(`${normName(rec.first_name, rec.last_name)}|${dob}`) : undefined;
  };

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];
  for (const rec of records) {
    const id = matchId(rec);
    if (!id) {
      toInsert.push(rec);
      continue;
    }
    // Merge: apply the row's non-empty values (new data wins), but never blank a
    // field the row omits, and never touch the photo (managed separately).
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (k === "photo_url" || k === "school_id") continue;
      if (v !== null && v !== undefined && v !== "") patch[k] = v;
    }
    toUpdate.push({ id, patch });
  }

  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error } = await supabase.from("members").insert(chunk);
    if (error) errors.push(`Batch ${Math.floor(i / 200) + 1}: ${error.message}`);
    else inserted += chunk.length;
  }
  for (const u of toUpdate) {
    const { error } = await supabase
      .from("members")
      .update(u.patch)
      .eq("id", u.id)
      .eq("school_id", schoolId);
    if (error) errors.push(`Update ${u.id.slice(0, 8)}: ${error.message}`);
    else updated += 1;
  }

  const failed = rows.length - inserted - updated;
  // Record the import so it shows in Recent activity / Audit log with a
  // success/failed status, and feeds the dashboard "Data imported" tile.
  await logAudit(admin, {
    schoolId,
    actorId: user.id,
    action: "members.imported",
    targetType: "members",
    meta: { total: rows.length, imported: inserted, updated, failed, status: failed === 0 ? "success" : "partial" },
  });

  revalidatePath("/members");
  revalidatePath("/dashboard");
  return { inserted, updated, failed, errors: errors.slice(0, 25) };
}
