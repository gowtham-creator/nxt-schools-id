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
  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .order("name");

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
          submitLabel="Add member"
        />
      </div>

      <details className="mt-8 max-w-md rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          + Add a class
        </summary>
        <form action={createClass} className="mt-3 grid grid-cols-3 gap-2">
          <input
            name="name"
            placeholder="Class (e.g. Grade 5)"
            required
            className="col-span-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
          <input
            name="section"
            placeholder="Section (A)"
            className="col-span-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Add
          </button>
        </form>
      </details>
    </div>
  );
}
