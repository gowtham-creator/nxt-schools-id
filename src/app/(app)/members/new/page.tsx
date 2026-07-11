import { createClient } from "@/lib/supabase/server";
import { MemberForm } from "../MemberForm";
import { createMember } from "../actions";
import type { ClassRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: classes }, { data: years }, { data: branches }] = await Promise.all([
    supabase.from("classes").select("*").order("name"),
    supabase
      .from("academic_years")
      .select("id, name, is_current")
      .order("name", { ascending: false }),
    supabase
      .from("branches")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Add member</h1>
      {sp.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>
      )}
      {sp.ok && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{sp.ok}</p>
      )}

      <div className="mt-5">
        <MemberForm
          action={createMember}
          classes={(classes ?? []) as ClassRow[]}
          academicYears={years ?? []}
          branches={branches ?? []}
          submitLabel="Add member"
        />
      </div>
    </div>
  );
}
