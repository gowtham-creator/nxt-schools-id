import { createClient } from "@/lib/supabase/server";
import { requireRole, getProfile } from "@/lib/auth";
import type { School } from "@/lib/types";
import { updateSchool } from "./actions";

export const dynamic = "force-dynamic";

const DEFAULT_PRIMARY = "#0F766E";
const DEFAULT_SECONDARY = "#0369A1";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  await requireRole(["super_admin", "admin"]);
  const { profile } = await getProfile();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("id", profile.school_id)
    .single();
  const school = data as School | null;

  return (
    <div className="max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">School Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Details used across generated ID cards and the verification page.
        </p>
      </div>

      {sp.ok && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{sp.ok}</p>
      )}
      {(sp.error || error) && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error || error?.message}
        </p>
      )}

      <form
        action={updateSchool}
        className="mt-5 space-y-5 rounded-xl border border-slate-200 bg-white p-6"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700">School name</label>
          <input
            name="name"
            defaultValue={school?.name ?? ""}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Short name</label>
          <input
            name="short_name"
            defaultValue={school?.short_name ?? ""}
            placeholder="e.g. NXT"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Current academic year</label>
          <input
            name="academic_year"
            defaultValue={school?.academic_year ?? ""}
            placeholder="e.g. 2026-2027"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Address</label>
          <textarea
            name="address"
            defaultValue={school?.address ?? ""}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input
              name="phone"
              defaultValue={school?.phone ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              name="email"
              type="email"
              defaultValue={school?.email ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Primary color</label>
            <div className="mt-1 flex items-center gap-3">
              <input
                name="primary_color"
                type="color"
                defaultValue={school?.primary_color ?? DEFAULT_PRIMARY}
                className="h-9 w-14 cursor-pointer rounded-md border border-slate-300 bg-white p-1"
              />
              <span className="text-xs text-slate-400">Used for card headers &amp; accents.</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Secondary color</label>
            <div className="mt-1 flex items-center gap-3">
              <input
                name="secondary_color"
                type="color"
                defaultValue={school?.secondary_color ?? DEFAULT_SECONDARY}
                className="h-9 w-14 cursor-pointer rounded-md border border-slate-300 bg-white p-1"
              />
              <span className="text-xs text-slate-400">Used for secondary elements.</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-5">
          <label className="block text-sm font-medium text-slate-700">Logo</label>
          <div className="mt-2 flex items-center gap-4">
            {school?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={school.logo_url}
                alt="School logo"
                className="h-16 w-16 rounded-md border border-slate-200 object-contain"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">
                None
              </div>
            )}
            <p className="text-xs text-slate-400">
              Logo upload: settings &gt; branding (coming soon), stored in the logos bucket.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-5">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
