import { createClient } from "@/lib/supabase/server";
import { MemberForm } from "../MemberForm";
import { createMember, createClass } from "../actions";
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

      <details className="card mt-8 max-w-md p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-600 transition-colors duration-150 hover:text-slate-900">
          + Add a class
        </summary>
        <form action={createClass} className="mt-4 grid grid-cols-3 items-end gap-3">
          <div className="col-span-1">
            <label htmlFor="class_name" className="field-label">
              Class
            </label>
            <input
              id="class_name"
              name="name"
              placeholder="e.g. Grade 5"
              required
              className="field-input"
            />
          </div>
          <div className="col-span-1">
            <label htmlFor="class_section" className="field-label">
              Section
            </label>
            <input
              id="class_section"
              name="section"
              placeholder="e.g. A"
              className="field-input"
            />
          </div>
          <button className="btn-primary btn-sm justify-self-start">Add</button>
        </form>
      </details>
    </div>
  );
}
