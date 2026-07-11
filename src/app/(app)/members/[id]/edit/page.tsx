import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberForm } from "../../MemberForm";
import { updateMember } from "../../actions";
import type { ClassRow, Member } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: member }, { data: classes }, { data: years }, { data: branches }] =
    await Promise.all([
      supabase.from("members").select("*").eq("id", id).maybeSingle(),
      supabase.from("classes").select("*").order("name"),
      supabase
        .from("academic_years")
        .select("id, name, is_current")
        .order("name", { ascending: false }),
      supabase.from("branches").select("id, name").eq("status", "active").order("name"),
    ]);

  if (!member) notFound();

  const cardUrl = (member as Member).card_pdf_url;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Edit member</h1>
        {cardUrl && (
          <a href={cardUrl} target="_blank" rel="noreferrer" className="btn-secondary">
            Download ID card
          </a>
        )}
      </div>
      {sp.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>
      )}
      <div className="mt-5">
        <MemberForm
          action={updateMember.bind(null, id)}
          classes={(classes ?? []) as ClassRow[]}
          academicYears={years ?? []}
          branches={branches ?? []}
          member={member as Member}
          submitLabel="Update member"
        />
      </div>
    </div>
  );
}
