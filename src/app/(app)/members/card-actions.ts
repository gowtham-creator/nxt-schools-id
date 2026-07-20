"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderCardPdf } from "@/lib/render/pdf";
import { renderPrintSheetPdf, renderCardGridPdf, type SheetEntry } from "@/lib/render/sheet";
import { logAudit } from "@/lib/audit";
import type { IdTemplate, Member, PipelineStatus, School } from "@/lib/types";

/**
 * Auth + school guard shared by every card action (mirrors members/actions.ts).
 * Redirects to /login when not authenticated, so callers can assume a user.
 */
async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("app_users")
    .select("school_id, role")
    .eq("id", user.id)
    .single();
  return { supabase, user, schoolId: (profile?.school_id ?? null) as string | null };
}

/** Columns the renderer needs off the member row. */
const MEMBER_SELECT =
  "id,school_id,member_type,identifier,first_name,last_name,photo_url,dob,gender,blood_group,class_id,roll_no,designation,department,guardian_name,guardian_phone,phone,email,address,valid_from,valid_until,status,qr_token,branch_id,template_id,academic_year_id,pipeline_status,card_pdf_url,card_generated_at,bg_removed,extra,created_at,updated_at";

/** School columns the renderer + per-type template resolution need.
 *  `academic_year` drives the dynamic "SESSION …" line on cards. */
const SCHOOL_RENDER_SELECT =
  "name,short_name,logo_url,signature_url,address,phone,email,academic_year,primary_color,secondary_color,student_template_id,staff_template_id";

/** Row shape returned by `SCHOOL_RENDER_SELECT`. */
type SchoolRenderRow = Pick<
  School,
  | "name"
  | "short_name"
  | "logo_url"
  | "signature_url"
  | "address"
  | "phone"
  | "email"
  | "academic_year"
  | "primary_color"
  | "secondary_color"
  | "student_template_id"
  | "staff_template_id"
>;

/** The Supabase client type as returned by our async `createClient()`. */
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve the template a member's card should render with:
 * member.template_id → the school's per-type default (staff_template_id /
 * student_template_id) → the legacy is_default template. Returns null if none.
 */
async function resolveTemplate(
  supabase: SupabaseClient,
  schoolId: string,
  member: Member,
  school: SchoolRenderRow,
): Promise<IdTemplate | null> {
  const byId = async (id: string): Promise<IdTemplate | null> => {
    const { data } = await supabase
      .from("id_templates")
      .select("*")
      .eq("id", id)
      .eq("school_id", schoolId)
      .single<IdTemplate>();
    return data ?? null;
  };

  let template: IdTemplate | null = null;
  if (member.template_id) template = await byId(member.template_id);

  if (!template) {
    const defaultId =
      member.member_type === "staff" ? school.staff_template_id : school.student_template_id;
    if (defaultId) template = await byId(defaultId);
  }

  if (!template) {
    const { data } = await supabase
      .from("id_templates")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_default", true)
      .single<IdTemplate>();
    template = data ?? null;
  }

  return template;
}

/**
 * Core single-row pipeline: load member + template + class + school, render the
 * CR80 PDF, upload it to the private `cards` bucket, save a 7-day signed URL and
 * move the member to `generated`. Returns true on success, false on any caught
 * error — so bulk callers can tally ok/failed without a redirect.
 */
/**
 * Reason for the most recent generateOne failure (per lambda instance).
 * Surfaced (truncated) in the /members error banner — serverless render
 * failures are otherwise invisible without log streaming.
 */
let lastGenerateError: string | null = null;

async function generateOne(
  supabase: SupabaseClient,
  schoolId: string,
  id: string,
): Promise<boolean> {
  lastGenerateError = null;
  try {
    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select(MEMBER_SELECT)
      .eq("id", id)
      .eq("school_id", schoolId)
      .single<Member>();
    if (memberErr || !member) return false;

    // School first — its per-type default template ids feed template resolution.
    const { data: school } = await supabase
      .from("schools")
      .select(SCHOOL_RENDER_SELECT)
      .eq("id", schoolId)
      .single<SchoolRenderRow>();
    if (!school) return false;

    // member.template_id → per-type school default → legacy is_default.
    const template = await resolveTemplate(supabase, schoolId, member, school);
    if (!template) {
      lastGenerateError = "no template assigned and no school default";
      return false;
    }

    const { data: classRow } = member.class_id
      ? await supabase
          .from("classes")
          .select("name,section")
          .eq("id", member.class_id)
          .single<{ name: string; section: string | null }>()
      : { data: null };

    const pdf: Uint8Array = await renderCardPdf(template, member, classRow, school);

    const path = `${schoolId}/${id}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("cards")
      .upload(path, pdf, { upsert: true, contentType: "application/pdf" });
    if (uploadErr) {
      lastGenerateError = `upload: ${uploadErr.message}`;
      return false;
    }

    const { data: signed } = await supabase.storage
      .from("cards")
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    const now = new (globalThis.Date)().toISOString();
    const { error: updateErr } = await supabase
      .from("members")
      .update({
        card_pdf_url: signed?.signedUrl ?? null,
        card_generated_at: now,
        pipeline_status: "generated" satisfies PipelineStatus,
      })
      .eq("id", id);
    if (updateErr) {
      lastGenerateError = `db update: ${updateErr.message}`;
      return false;
    }

    return true;
  } catch (err) {
    lastGenerateError = err instanceof Error ? err.message : String(err);
    return false;
  }
}

/**
 * Renders the member's ID card to a CR80 PDF, stores it in the private `cards`
 * bucket, saves a 7-day signed URL on the member and moves it to `generated`.
 */
export async function generateCard(id: string) {
  const { supabase, schoolId, user } = await ctx();
  if (!schoolId) redirect("/members?error=No+school+assigned+to+your+account");

  // Belt-and-braces: generateOne already catches render/upload/update failures
  // and returns false, but wrap it so any unexpected throw is surfaced as a
  // redirect('/members?error=...') rather than an unhandled Server Action crash.
  // The redirect() calls stay OUTSIDE this try so their NEXT_REDIRECT control
  // signal is never swallowed.
  let ok = false;
  try {
    ok = await generateOne(supabase, schoolId, id);
  } catch {
    ok = false;
  }
  if (!ok) {
    const reason = `Card generation failed — ${lastGenerateError ?? "unknown"}`.slice(0, 180);
    redirect(`/members?error=${encodeURIComponent(reason)}`);
  }

  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "card.generated",
    targetType: "member",
    targetId: id,
  });

  revalidatePath("/members");
  redirect("/members?ok=Card+generated");
}

/**
 * Generates cards for many members in one go. Sequential is fine here — the
 * headless render browser is a singleton. Returns ok/failed counts (no redirect).
 */
export async function bulkGenerate(ids: string[]): Promise<{ ok: number; failed: number }> {
  const { supabase, schoolId, user } = await ctx();
  if (!schoolId) return { ok: 0, failed: ids.length };

  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    const success = await generateOne(supabase, schoolId, id);
    if (success) ok += 1;
    else failed += 1;
  }

  if (ok > 0) {
    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "card.generated",
      targetType: "member",
      meta: { count: ok, failed, ids },
    });
  }

  revalidatePath("/members");
  return { ok, failed };
}

/** Assigns one template to many members (scoped to the caller's school). */
export async function bulkAssignTemplate(
  ids: string[],
  templateId: string,
): Promise<{ ok: number }> {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) return { ok: 0 };

  const { error } = await supabase
    .from("members")
    .update({ template_id: templateId })
    .in("id", ids)
    .eq("school_id", schoolId);
  if (error) return { ok: 0 };

  revalidatePath("/members");
  return { ok: ids.length };
}

/** Sets the pipeline status on many members (scoped to the caller's school). */
export async function bulkAdvance(
  ids: string[],
  to: PipelineStatus,
): Promise<{ ok: number }> {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) return { ok: 0 };

  const { error } = await supabase
    .from("members")
    .update({ pipeline_status: to })
    .in("id", ids)
    .eq("school_id", schoolId);
  if (error) return { ok: 0 };

  revalidatePath("/members");
  return { ok: ids.length };
}

/** Moves a member forward in the print pipeline (generated -> ... -> printed). */
export async function advanceStatus(id: string, to: PipelineStatus) {
  const { supabase, schoolId, user } = await ctx();
  const { error } = await supabase
    .from("members")
    .update({ pipeline_status: to })
    .eq("id", id);
  if (error) redirect(`/members?error=${encodeURIComponent(error.message)}`);

  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "card.status_changed",
    targetType: "member",
    targetId: id,
    meta: { to },
  });

  revalidatePath("/members");
  redirect("/members?ok=Updated");
}

/**
 * Renders the selected members' cards onto duplex-ready A4 sheets (fronts page
 * then mirrored backs page, cut guides included), uploads the PDF to the
 * private `cards` bucket and returns a 24-hour signed URL. No redirect — the
 * client opens the URL itself.
 */
export async function printSheet(
  ids: string[],
): Promise<{ url: string | null; error: string | null }> {
  const { supabase, schoolId, user } = await ctx();
  if (!schoolId) return { url: null, error: "No school assigned to your account" };
  if (ids.length === 0) return { url: null, error: "No members selected" };

  try {
    const { data: members, error: membersErr } = await supabase
      .from("members")
      .select(MEMBER_SELECT)
      .in("id", ids)
      .eq("school_id", schoolId);
    if (membersErr) return { url: null, error: membersErr.message };
    const rows = (members ?? []) as Member[];
    if (rows.length === 0) return { url: null, error: "No members found" };

    const { data: school } = await supabase
      .from("schools")
      .select(SCHOOL_RENDER_SELECT)
      .eq("id", schoolId)
      .single<SchoolRenderRow>();
    if (!school) return { url: null, error: "School not found" };

    // One query for every class the batch references.
    const classIds = [
      ...new Set(rows.map((m) => m.class_id).filter((v): v is string => v != null)),
    ];
    const classMap = new Map<string, { name: string; section: string | null }>();
    if (classIds.length > 0) {
      const { data: classes } = await supabase
        .from("classes")
        .select("id,name,section")
        .in("id", classIds);
      for (const c of (classes ?? []) as { id: string; name: string; section: string | null }[]) {
        classMap.set(c.id, { name: c.name, section: c.section });
      }
    }

    // Same resolution order as generateOne; memoised so a batch sharing one
    // template (or one per-type default) costs one query, not one per member.
    const templateCache = new Map<string, IdTemplate | null>();
    const entries: SheetEntry[] = [];
    for (const member of rows) {
      const cacheKey = member.template_id ?? `type:${member.member_type}`;
      let template = templateCache.get(cacheKey);
      if (template === undefined) {
        template = await resolveTemplate(supabase, schoolId, member, school);
        templateCache.set(cacheKey, template);
      }
      if (!template) {
        const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
        return { url: null, error: `No template found for ${name}` };
      }
      entries.push({
        template,
        member,
        classRow: member.class_id ? classMap.get(member.class_id) ?? null : null,
      });
    }

    const pdf: Uint8Array = await renderPrintSheetPdf(entries, school);

    const path = `${schoolId}/sheets/sheet-${new (globalThis.Date)().getTime()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("cards")
      .upload(path, pdf, { upsert: true, contentType: "application/pdf" });
    if (uploadErr) return { url: null, error: `upload: ${uploadErr.message}` };

    const { data: signed } = await supabase.storage
      .from("cards")
      .createSignedUrl(path, 60 * 60 * 24);
    if (!signed?.signedUrl) return { url: null, error: "Could not create a download link" };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "sheet.printed",
      targetType: "member",
      meta: { count: entries.length, ids },
    });

    return { url: signed.signedUrl, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Build a "card image set": `cols`×`rows` card fronts per A4 page (default 5×5 =
 * 25 per page), scaled to fit. Returns a signed download URL. Mirrors printSheet
 * but renders a grid proof sheet instead of a duplex print run.
 */
export async function printCardGrid(
  ids: string[],
  cols = 5,
  rows = 5,
): Promise<{ url: string | null; error: string | null }> {
  const { supabase, schoolId, user } = await ctx();
  if (!schoolId) return { url: null, error: "No school assigned to your account" };
  if (ids.length === 0) return { url: null, error: "No members selected" };

  try {
    const { data: members, error: membersErr } = await supabase
      .from("members")
      .select(MEMBER_SELECT)
      .in("id", ids)
      .eq("school_id", schoolId);
    if (membersErr) return { url: null, error: membersErr.message };
    const rows_ = (members ?? []) as Member[];
    if (rows_.length === 0) return { url: null, error: "No members found" };

    const { data: school } = await supabase
      .from("schools")
      .select(SCHOOL_RENDER_SELECT)
      .eq("id", schoolId)
      .single<SchoolRenderRow>();
    if (!school) return { url: null, error: "School not found" };

    const classIds = [
      ...new Set(rows_.map((m) => m.class_id).filter((v): v is string => v != null)),
    ];
    const classMap = new Map<string, { name: string; section: string | null }>();
    if (classIds.length > 0) {
      const { data: classes } = await supabase
        .from("classes")
        .select("id,name,section")
        .in("id", classIds);
      for (const c of (classes ?? []) as { id: string; name: string; section: string | null }[]) {
        classMap.set(c.id, { name: c.name, section: c.section });
      }
    }

    const templateCache = new Map<string, IdTemplate | null>();
    const entries: SheetEntry[] = [];
    for (const member of rows_) {
      const cacheKey = member.template_id ?? `type:${member.member_type}`;
      let template = templateCache.get(cacheKey);
      if (template === undefined) {
        template = await resolveTemplate(supabase, schoolId, member, school);
        templateCache.set(cacheKey, template);
      }
      if (!template) {
        const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
        return { url: null, error: `No template found for ${name}` };
      }
      entries.push({
        template,
        member,
        classRow: member.class_id ? classMap.get(member.class_id) ?? null : null,
      });
    }

    const pdf: Uint8Array = await renderCardGridPdf(entries, school, cols, rows);
    const path = `${schoolId}/sheets/grid-${new (globalThis.Date)().getTime()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("cards")
      .upload(path, pdf, { upsert: true, contentType: "application/pdf" });
    if (uploadErr) return { url: null, error: `upload: ${uploadErr.message}` };

    const { data: signed } = await supabase.storage
      .from("cards")
      .createSignedUrl(path, 60 * 60 * 24);
    if (!signed?.signedUrl) return { url: null, error: "Could not create a download link" };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "sheet.printed",
      targetType: "member",
      meta: { count: entries.length, grid: `${cols}x${rows}`, ids },
    });
    return { url: signed.signedUrl, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Resets a member's card back to the start of the pipeline. */
export async function resetCard(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("members")
    .update({
      pipeline_status: "not_generated" satisfies PipelineStatus,
      card_pdf_url: null,
    })
    .eq("id", id);
  if (error) redirect(`/members?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/members");
  redirect("/members?ok=Updated");
}
