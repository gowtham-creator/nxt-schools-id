import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Branch } from "@/lib/types";
import { updateBranch } from "../actions";

export const dynamic = "force-dynamic";

export default async function BranchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase.from("branches").select("*").eq("id", id).single();
  if (!data) notFound();
  const branch = data as Branch;

  // Per-branch funnel counts (RLS-scoped, head-only count queries run in parallel).
  const base = () =>
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", id);

  const [total, withImage, generated, sent, printed] = await Promise.all([
    base(),
    base().not("photo_url", "is", null),
    base().neq("pipeline_status", "not_generated"),
    base().in("pipeline_status", ["sent_for_printing", "printed"]),
    base().eq("pipeline_status", "printed"),
  ]);

  const funnel = [
    { label: "Total students", value: total.count ?? 0 },
    { label: "Image uploaded", value: withImage.count ?? 0 },
    { label: "ID generated", value: generated.count ?? 0 },
    { label: "Sent", value: sent.count ?? 0 },
    { label: "Printed", value: printed.count ?? 0 },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/branches" className="text-sm text-slate-500 hover:underline">
            ← Branches
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{branch.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                branch.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {branch.status}
            </span>
          </p>
        </div>
      </div>

      {sp.ok && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{sp.ok}</p>
      )}
      {sp.error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>
      )}

      {/* Funnel */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {funnel.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-2xl font-semibold text-slate-900">{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Edit info */}
      <div className="mt-8 max-w-2xl rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-700">Branch details</h2>
        <form
          action={updateBranch.bind(null, branch.id)}
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500">Name</label>
            <input
              name="name"
              defaultValue={branch.name}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Email</label>
            <input
              name="email"
              type="email"
              defaultValue={branch.email ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Phone</label>
            <input
              name="phone"
              defaultValue={branch.phone ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500">Address</label>
            <input
              name="address"
              defaultValue={branch.address ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
