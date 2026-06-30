import { createClient } from "@/lib/supabase/server";
import type { AcademicYear } from "@/lib/types";
import { createAcademicYear, setCurrentYear, deleteAcademicYear } from "./actions";

export const dynamic = "force-dynamic";

export default async function AcademicYearsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("academic_years")
    .select("id,school_id,name,start_date,end_date,is_current,created_at")
    .order("is_current", { ascending: false })
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as AcademicYear[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Academic years</h1>
          <p className="mt-1 text-sm text-slate-500">Sessions used to scope members &amp; cards.</p>
        </div>
      </div>

      {sp.ok && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{sp.ok}</p>
      )}
      {(sp.error || error) && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error || error?.message}
        </p>
      )}

      {/* Add academic year */}
      <details className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-900">
          + Add academic year
        </summary>
        <form action={createAcademicYear} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Name</label>
            <input
              name="name"
              required
              placeholder="2024-2025"
              className="mt-1 w-48 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Start date</label>
            <input
              type="date"
              name="start_date"
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">End date</label>
            <input
              type="date"
              name="end_date"
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="is_current"
              className="h-4 w-4 rounded border-slate-300"
            />
            Set as current
          </label>
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Add
          </button>
        </form>
      </details>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Start</th>
              <th className="px-4 py-3 font-medium">End</th>
              <th className="px-4 py-3 font-medium">Current</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No academic years yet. Click{" "}
                  <span className="font-medium">+ Add academic year</span> to create one.
                </td>
              </tr>
            )}
            {rows.map((y) => (
              <tr key={y.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{y.name}</td>
                <td className="px-4 py-2 text-slate-600">{y.start_date ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{y.end_date ?? "—"}</td>
                <td className="px-4 py-2">
                  {y.is_current ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      Current
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {!y.is_current && (
                    <form action={setCurrentYear.bind(null, y.id)} className="inline">
                      <button className="text-slate-600 hover:underline">Set current</button>
                    </form>
                  )}
                  <form action={deleteAcademicYear.bind(null, y.id)} className="ml-3 inline">
                    <button className="text-red-600 hover:underline">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">{rows.length} year(s).</p>
    </div>
  );
}
