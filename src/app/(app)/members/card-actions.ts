"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderCardPdf } from "@/lib/render/pdf";
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

/** The Supabase client type as returned by our async `createClient()`. */
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

    // The member's own template, else the school's default id_template.
    let template: IdTemplate | null = null;
    if (member.template_id) {
      const { data } = await supabase
        .from("id_templates")
        .select("*")
        .eq("id", member.template_id)
        .eq("school_id", schoolId)
        .single<IdTemplate>();
      template = data ?? null;
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
    if (!template) return false;

    const { data: classRow } = member.class_id
      ? await supabase
          .from("classes")
          .select("name,section")
          .eq("id", member.class_id)
          .single<{ name: string; section: string | null }>()
      : { data: null };

    const { data: school } = await supabase
      .from("schools")
      .select("name,short_name,logo_url,primary_color,secondary_color")
      .eq("id", schoolId)
      .single<Partial<School>>();
    if (!school) return false;

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
