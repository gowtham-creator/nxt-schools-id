import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MEMBER_TYPE_LABELS } from "@/lib/constants";
import { deleteMember } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  member_type: "student" | "staff";
  identifier: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  roll_no: string | null;
  status: string;
  classes: { name: string; section: string | null } | null;
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("members")
    .select(
      "id,member_type,identifier,first_name,last_name,photo_url,roll_no,status,classes(name,section)",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (sp.q) {
    const q = sp.q.replace(/[%,]/g, "");
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,identifier.ilike.%${q}%`,
    );
  }
  if (sp.type === "student" || sp.type === "staff") query = query.eq("member_type", sp.type);

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Members</h1>
          <p className="mt-1 text-sm text-slate-500">Students &amp; staff records.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/members/import"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Import CSV/Excel
          </Link>
          <Link
            href="/members/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + Add member
          </Link>
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

      {/* Search / filter */}
      <form className="mt-5 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name or ID…"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <select
          name="type"
          defaultValue={sp.type ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="student">Students</option>
          <option value="staff">Staff</option>
        </select>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Photo</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No members yet. Click <span className="font-medium">+ Add member</span> or import a sheet.
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-100" />
                  )}
                </td>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {m.first_name} {m.last_name}
                </td>
                <td className="px-4 py-2 text-slate-600">{MEMBER_TYPE_LABELS[m.member_type]}</td>
                <td className="px-4 py-2 text-slate-600">{m.identifier ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">
                  {m.classes ? `${m.classes.name}${m.classes.section ? " - " + m.classes.section : ""}` : "—"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      m.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/members/${m.id}/edit`} className="text-slate-600 hover:underline">
                    Edit
                  </Link>
                  <form action={deleteMember.bind(null, m.id)} className="ml-3 inline">
                    <button className="text-red-600 hover:underline">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">{rows.length} shown (max 300).</p>
    </div>
  );
}
