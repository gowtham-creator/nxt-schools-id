import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Branch } from "@/lib/types";
import { createBranch, deleteBranch, setBranchStatus } from "./actions";

export const dynamic = "force-dynamic";

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("name");
  const branches = (data ?? []) as Branch[];

  // Student count per branch (single RLS-scoped query, tallied in memory).
  const { data: memberRows } = await supabase.from("members").select("branch_id");
  const counts = new Map<string, number>();
  for (const row of (memberRows ?? []) as { branch_id: string | null }[]) {
    if (row.branch_id) counts.set(row.branch_id, (counts.get(row.branch_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Branches</h1>
          <p className="mt-1 text-sm text-slate-500">Campuses &amp; centres for your school.</p>
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

      {/* Add branch */}
      <details className="mt-5 max-w-2xl rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          + Add branch
        </summary>
        <form action={createBranch} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="field-label">Branch name</label>
            <input
              id="name"
              name="name"
              placeholder="Branch name (e.g. Main Campus)"
              required
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Email (optional)"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="phone" className="field-label">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Phone (optional)"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="address" className="field-label">Address</label>
            <input
              id="address"
              name="address"
              placeholder="Address (optional)"
              className="field-input"
            />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary">
              Add branch
            </button>
          </div>
        </form>
      </details>

      {/* Table */}
      <div className="card mt-5 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Students</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {branches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No branches yet. Click <span className="font-medium">+ Add branch</span> to create one.
                </td>
              </tr>
            )}
            {branches.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">
                  <Link href={`/branches/${b.id}`} className="hover:underline">
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{b.email ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{counts.get(b.id) ?? 0}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      b.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/branches/${b.id}`} className="text-slate-600 hover:text-slate-900">
                    Edit
                  </Link>
                  {b.status === "active" ? (
                    <form
                      action={setBranchStatus.bind(null, b.id, "inactive")}
                      className="ml-3 inline"
                    >
                      <button className="btn-ghost btn-sm">Deactivate</button>
                    </form>
                  ) : (
                    <form
                      action={setBranchStatus.bind(null, b.id, "active")}
                      className="ml-3 inline"
                    >
                      <button className="btn-ghost btn-sm">Activate</button>
                    </form>
                  )}
                  <form action={deleteBranch.bind(null, b.id)} className="ml-3 inline">
                    <button className="btn-danger btn-sm">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">{branches.length} branch(es).</p>
    </div>
  );
}
