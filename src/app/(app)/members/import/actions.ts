"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberSchema } from "@/lib/validators";

type ImportRow = Record<string, string>;

export async function importMembers(
  rows: ImportRow[],
): Promise<{ inserted: number; failed: number; errors: string[] }> {
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
  if (!schoolId) return { inserted: 0, failed: rows.length, errors: ["No school assigned to your account"] };
  if (!rows.length) return { inserted: 0, failed: 0, errors: ["No rows to import"] };

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
  const wanted = new Map<string, { name: string; section: string }>();
  for (const r of rows) {
    const name = (r.class ?? "").trim();
    if (!name) continue;
    wanted.set(classKey(name, (r.section ?? "").trim()), {
      name,
      section: (r.section ?? "").trim(),
    });
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

  const errors: string[] = [];
  const records: Record<string, unknown>[] = [];
  rows.forEach((r, i) => {
    const className = (r.class ?? "").trim();
    const candidate = {
      member_type: (r.member_type ?? "student").toLowerCase() === "staff" ? "staff" : "student",
      identifier: r.identifier ?? "",
      first_name: r.first_name ?? "",
      last_name: r.last_name ?? "",
      class_id: className ? (classMap.get(classKey(className, (r.section ?? "").trim())) ?? "") : "",
      roll_no: r.roll_no ?? "",
      dob: r.dob ?? "",
      gender: r.gender ?? "",
      blood_group: r.blood_group ?? "",
      guardian_name: r.guardian_name ?? "",
      guardian_phone: r.guardian_phone ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      status: "active",
      photo_url: "",
    };
    const parsed = memberSchema.safeParse(candidate);
    if (!parsed.success) errors.push(`Row ${i + 2}: ${parsed.error.issues[0].message}`);
    else records.push({ ...parsed.data, school_id: schoolId });
  });

  let inserted = 0;
  for (let i = 0; i < records.length; i += 200) {
    const chunk = records.slice(i, i + 200);
    const { error } = await supabase.from("members").insert(chunk);
    if (error) errors.push(`Batch ${Math.floor(i / 200) + 1}: ${error.message}`);
    else inserted += chunk.length;
  }

  revalidatePath("/members");
  return { inserted, failed: rows.length - inserted, errors: errors.slice(0, 25) };
}
