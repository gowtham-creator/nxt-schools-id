"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { STANDARD_GRADES } from "@/lib/constants";
import type { MemberType } from "@/lib/types";

/**
 * The six standard templates every new school is provisioned with.
 * Names must match scripts/seed-standard-templates.mjs exactly
 * (note the en-dash in "Green–Blue" and the em-dashes before the orientation).
 */
const STANDARD_TEMPLATE_NAMES = [
  "Classic Green–Blue — Portrait",
  "Royal Maroon — Portrait",
  "Indigo Classic — Landscape",
  "Sunrise — Portrait",
  "Staff Navy — Portrait",
  "Staff Crimson — Landscape",
] as const;

const STUDENT_DEFAULT = "Classic Green–Blue — Portrait";
const STAFF_DEFAULT = "Staff Navy — Portrait";

/** Donor template row copied verbatim (id/timestamps/school/is_default stripped). */
type DonorTemplate = {
  school_id: string;
  name: string;
  member_type: MemberType;
  width_mm: number;
  height_mm: number;
  dpi: number;
  orientation: "landscape" | "portrait";
  front: unknown;
  back: unknown;
  created_by: string | null;
  created_at: string;
};

function fail(message: string): never {
  redirect(`/platform?error=${encodeURIComponent(message)}`);
}

/**
 * Copy the six standard templates from the oldest school that owns all of
 * them, then wire the new school's student/staff defaults. Best-effort: a
 * school without templates still onboards (shows "No templates" on /platform).
 */
async function provisionTemplates(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
): Promise<void> {
  const { data: candidateRows } = await admin
    .from("id_templates")
    .select(
      "school_id, name, member_type, width_mm, height_mm, dpi, orientation, front, back, created_by, created_at",
    )
    .in("name", [...STANDARD_TEMPLATE_NAMES])
    .order("created_at", { ascending: true });
  const candidates = (candidateRows ?? []) as DonorTemplate[];

  // Group by owning school, then pick the first owner (by oldest template)
  // that has the full set of six.
  const bySchool = new Map<string, DonorTemplate[]>();
  for (const row of candidates) {
    const list = bySchool.get(row.school_id) ?? [];
    list.push(row);
    bySchool.set(row.school_id, list);
  }
  let donor: DonorTemplate[] | null = null;
  for (const row of candidates) {
    const list = bySchool.get(row.school_id) ?? [];
    const names = new Set(list.map((t) => t.name));
    if (STANDARD_TEMPLATE_NAMES.every((n) => names.has(n))) {
      donor = list;
      break;
    }
  }
  if (!donor) return;

  // One copy per name (a re-seeded donor could hold duplicates).
  const byName = new Map<string, DonorTemplate>();
  for (const t of donor) {
    if (!byName.has(t.name)) byName.set(t.name, t);
  }

  const { data: insertedRows, error: copyError } = await admin
    .from("id_templates")
    .insert(
      [...byName.values()].map((t) => ({
        school_id: schoolId,
        name: t.name,
        member_type: t.member_type,
        width_mm: t.width_mm,
        height_mm: t.height_mm,
        dpi: t.dpi,
        orientation: t.orientation,
        front: t.front,
        back: t.back,
        is_default: false,
        created_by: t.created_by,
      })),
    )
    .select("id, name");
  if (copyError || !insertedRows) return;

  const inserted = insertedRows as { id: string; name: string }[];
  const studentTpl = inserted.find((t) => t.name === STUDENT_DEFAULT);
  const staffTpl = inserted.find((t) => t.name === STAFF_DEFAULT);

  if (studentTpl) {
    await admin
      .from("id_templates")
      .update({ is_default: true })
      .eq("id", studentTpl.id);
  }
  await admin
    .from("schools")
    .update({
      student_template_id: studentTpl?.id ?? null,
      staff_template_id: staffTpl?.id ?? null,
    })
    .eq("id", schoolId);
}

/**
 * Onboard a brand-new tenant: schools row, school-admin login, current
 * academic year, and a copy of the six standard templates with defaults.
 * Mirrors scripts/onboard-school.mjs + seed-standard-templates.mjs.
 */
export async function onboardSchool(fd: FormData) {
  const me = await requireRole(["super_admin"]);

  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const address = String(fd.get("address") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();

  if (!name || !email || !password) {
    fail("School name, admin email and temp password are required");
  }
  if (password.length < 8) {
    fail("Temp password must be at least 8 characters");
  }

  const admin = createAdminClient();

  // a) Tenant row — refuse duplicate school names.
  const { data: existing } = await admin
    .from("schools")
    .select("id")
    .eq("name", name)
    .maybeSingle<{ id: string }>();
  if (existing) redirect("/platform?error=School+already+exists");

  const short_name = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 6);

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({
      name,
      short_name,
      address: address || null,
      phone: phone || null,
      academic_year: "2026-27",
    })
    .select("id")
    .single<{ id: string }>();
  if (schoolError || !school) {
    fail(schoolError?.message ?? "Could not create the school");
  }

  // b) School-admin login (e.g. fails with "already registered").
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${name} Admin` },
  });
  if (userError || !created.user) {
    // Don't leave an orphan tenant behind — a retry would hit "already exists".
    await admin.from("schools").delete().eq("id", school.id);
    fail(userError?.message ?? "Could not create the admin login");
  }

  // c) app_users profile — the handle_new_user trigger may have inserted one.
  const userId = created.user.id;
  const profile = {
    school_id: school.id,
    role: "admin",
    full_name: `${name} Admin`,
  };
  const { data: profileRow } = await admin
    .from("app_users")
    .select("id")
    .eq("id", userId)
    .maybeSingle<{ id: string }>();
  const { error: profileError } = profileRow
    ? await admin.from("app_users").update(profile).eq("id", userId)
    : await admin.from("app_users").insert({ id: userId, ...profile });
  if (profileError) fail(profileError.message);

  // d) Current academic year.
  const { error: yearError } = await admin.from("academic_years").insert({
    school_id: school.id,
    name: "2026-27",
    start_date: "2026-06-01",
    end_date: "2027-04-30",
    is_current: true,
  });
  if (yearError) fail(yearError.message);

  // e) Copy the six standard templates + set student/staff defaults.
  await provisionTemplates(admin, school.id);

  // e2) Seed the standard grade ladder so the Class dropdown is populated.
  await admin
    .from("classes")
    .insert(STANDARD_GRADES.map((name) => ({ school_id: school.id, name })));

  // f) Audit trail.
  await logAudit(admin, {
    schoolId: school.id,
    actorId: me.id,
    action: "school.onboarded",
    targetType: "school",
    targetId: school.id,
    meta: { name, admin_email: email },
  });

  // g) Done.
  revalidatePath("/platform");
  redirect(`/platform?ok=${encodeURIComponent(`${name} onboarded, login ${email}`)}`);
}

/**
 * Suspend or reactivate a whole school's access. We ban (or un-ban) every
 * non-super-admin login for that tenant at the auth layer: a banned user can't
 * sign in and can't refresh a token, so access is cut without touching data.
 * Super admins are never banned. Called from the Platform console.
 */
export async function setSchoolAccess(
  schoolId: string,
  suspend: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  const me = await requireRole(["super_admin"]);
  const admin = createAdminClient();

  const { data: users, error: usersErr } = await admin
    .from("app_users")
    .select("id, role")
    .eq("school_id", schoolId)
    .in("role", ["admin", "operator"]);
  if (usersErr) return { ok: false, error: usersErr.message };

  const banDuration = suspend ? "876000h" : "none"; // ~100 years, or lift the ban
  let failed = 0;
  for (const u of (users ?? []) as { id: string; role: string }[]) {
    const { error } = await admin.auth.admin.updateUserById(u.id, {
      ban_duration: banDuration,
    });
    if (error) failed += 1;
  }

  await logAudit(admin, {
    schoolId,
    actorId: me.id,
    action: suspend ? "school.suspended" : "school.reactivated",
    targetType: "school",
    targetId: schoolId,
    meta: { affected: (users ?? []).length, failed },
  });

  revalidatePath("/platform");
  if (failed > 0) return { ok: false, error: `${failed} login(s) could not be updated` };
  return { ok: true, error: null };
}

/**
 * PERMANENTLY delete a school and everything belonging to it. Super-admin only.
 *
 * Guard rails, because this is irreversible:
 *   1. the school must already be SUSPENDED (cut access first, then remove), and
 *   2. the caller must retype the school's exact name.
 *
 * Order matters: auth logins and storage objects are cleaned up first (they are
 * NOT covered by the database cascade — app_users.school_id is ON DELETE SET
 * NULL, which would otherwise leave orphaned logins that can still sign in).
 * Deleting the `schools` row then cascades members, classes, templates,
 * branches, academic years and card batches.
 */
export async function deleteSchool(
  schoolId: string,
  confirmName: string,
): Promise<{ ok: boolean; error: string | null }> {
  const me = await requireRole(["super_admin"]);
  const admin = createAdminClient();

  const { data: school } = await admin
    .from("schools")
    .select("id, name")
    .eq("id", schoolId)
    .maybeSingle<{ id: string; name: string }>();
  if (!school) return { ok: false, error: "School not found." };

  // 2. Typed name must match exactly (case/space-insensitive).
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  if (norm(confirmName) !== norm(school.name)) {
    return { ok: false, error: "The name you typed does not match the school name." };
  }

  // Tenant logins for this school.
  const { data: users, error: usersErr } = await admin
    .from("app_users")
    .select("id, role")
    .eq("school_id", schoolId)
    .in("role", ["admin", "operator"]);
  if (usersErr) return { ok: false, error: usersErr.message };
  const tenantUsers = (users ?? []) as { id: string; role: string }[];

  // 1. Must be suspended first — every tenant login banned (a school with no
  //    logins at all counts as suspended, there is nothing left to cut off).
  for (const u of tenantUsers) {
    const { data: got } = await admin.auth.admin.getUserById(u.id);
    const bannedUntil = (got?.user as { banned_until?: string | null } | undefined)?.banned_until;
    const banned = !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();
    if (!banned) {
      return {
        ok: false,
        error: "Suspend the school's access first, then delete it.",
      };
    }
  }

  // Remove stored files (photos / generated cards / logos) — storage is not
  // covered by the database cascade. Best-effort: never block the delete.
  for (const bucket of ["photos", "cards", "logos"] as const) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(schoolId, { limit: 1000 });
      const paths = (files ?? []).map((f) => `${schoolId}/${f.name}`);
      // One nested level (e.g. cards/<school>/sheets/*).
      for (const f of files ?? []) {
        const { data: sub } = await admin.storage
          .from(bucket)
          .list(`${schoolId}/${f.name}`, { limit: 1000 });
        for (const s of sub ?? []) paths.push(`${schoolId}/${f.name}/${s.name}`);
      }
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    } catch {
      /* storage cleanup is best-effort */
    }
  }

  // Delete the tenant's auth logins so no orphaned account can ever sign in.
  for (const u of tenantUsers) {
    try {
      await admin.auth.admin.deleteUser(u.id);
    } catch {
      /* app_users row goes away with the cascade regardless */
    }
  }
  await admin.from("app_users").delete().eq("school_id", schoolId);

  // Audit BEFORE the row disappears (audit_log.school_id is ON DELETE SET NULL,
  // so the entry survives with the name recorded in `meta`).
  await logAudit(admin, {
    schoolId,
    actorId: me.id,
    action: "school.deleted",
    targetType: "school",
    targetId: schoolId,
    meta: { name: school.name, logins_removed: tenantUsers.length },
  });

  // Cascades members, classes, id_templates, branches, academic_years, cards.
  const { error: delErr } = await admin.from("schools").delete().eq("id", schoolId);
  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath("/platform");
  revalidatePath("/dashboard");
  return { ok: true, error: null };
}
