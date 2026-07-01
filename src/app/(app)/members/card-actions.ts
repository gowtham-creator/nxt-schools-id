"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderCardPdf } from "@/lib/render/pdf";
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

/**
 * Renders the member's ID card to a CR80 PDF, stores it in the private `cards`
 * bucket, saves a 7-day signed URL on the member and moves it to `generated`.
 */
export async function generateCard(id: string) {
  const { supabase, schoolId } = await ctx();
  if (!schoolId) redirect("/members?error=No+school+assigned+to+your+account");

  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select(MEMBER_SELECT)
    .eq("id", id)
    .eq("school_id", schoolId)
    .single<Member>();
  if (memberErr || !member) redirect("/members?error=Member+not+found");

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
  if (!template) redirect("/members?error=No+template+found.+Set+a+default+template+first");

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
  if (!school) redirect("/members?error=School+not+found");

  const pdf: Uint8Array = await renderCardPdf(template, member, classRow, school);

  const path = `${schoolId}/${id}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("cards")
    .upload(path, pdf, { upsert: true, contentType: "application/pdf" });
  if (uploadErr) redirect(`/members?error=${encodeURIComponent(uploadErr.message)}`);

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
  if (updateErr) redirect(`/members?error=${encodeURIComponent(updateErr.message)}`);

  revalidatePath("/members");
  redirect("/members?ok=Card+generated");
}

/** Moves a member forward in the print pipeline (generated -> ... -> printed). */
export async function advanceStatus(id: string, to: PipelineStatus) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("members")
    .update({ pipeline_status: to })
    .eq("id", id);
  if (error) redirect(`/members?error=${encodeURIComponent(error.message)}`);
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
