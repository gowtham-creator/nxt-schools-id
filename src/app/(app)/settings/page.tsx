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
        className="card mt-5 space-y-5 p-6"
      >
        <div>
          <label htmlFor="name" className="field-label">School name</label>
          <input
            id="name"
            name="name"
            defaultValue={school?.name ?? ""}
            required
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="short_name" className="field-label">Short name</label>
          <input
            id="short_name"
            name="short_name"
            defaultValue={school?.short_name ?? ""}
            placeholder="e.g. NXT"
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="academic_year" className="field-label">Current academic year</label>
          <input
            id="academic_year"
            name="academic_year"
            defaultValue={school?.academic_year ?? ""}
            placeholder="e.g. 2026-2027"
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="address" className="field-label">Address</label>
          <textarea
            id="address"
            name="address"
            defaultValue={school?.address ?? ""}
            rows={3}
            className="field-input"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="field-label">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={school?.phone ?? ""}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={school?.email ?? ""}
              className="field-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="primary_color" className="field-label">Primary color</label>
            <div className="mt-1 flex items-center gap-3">
              <input
                id="primary_color"
                name="primary_color"
                type="color"
                defaultValue={school?.primary_color ?? DEFAULT_PRIMARY}
                className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300 p-1"
              />
              <span className="text-xs text-slate-400">Used for card headers &amp; accents.</span>
            </div>
          </div>
          <div>
            <label htmlFor="secondary_color" className="field-label">Secondary color</label>
            <div className="mt-1 flex items-center gap-3">
              <input
                id="secondary_color"
                name="secondary_color"
                type="color"
                defaultValue={school?.secondary_color ?? DEFAULT_SECONDARY}
                className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300 p-1"
              />
              <span className="text-xs text-slate-400">Used for secondary elements.</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-5">
          <label className="field-label">Logo</label>
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
          <button className="btn-primary">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
