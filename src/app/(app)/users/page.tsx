import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import type { AppRole } from "@/lib/types";
import { inviteUser, setUserRole, deleteUser } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  full_name: string | null;
  role: AppRole;
  created_at: string;
};

/** Badge colors per role. */
const ROLE_BADGE: Record<AppRole, string> = {
  super_admin: "bg-violet-50 text-violet-700",
  admin: "bg-blue-50 text-blue-700",
  operator: "bg-slate-100 text-slate-500",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const me = await requireRole(["super_admin", "admin"]);
  const sp = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_users")
    .select("id, full_name, role, created_at")
    .eq("school_id", me.school_id)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as Row[];

  // Admins can assign operator/admin; super admins can also assign super_admin.
  const assignableRoles: AppRole[] =
    me.role === "super_admin"
      ? ["operator", "admin", "super_admin"]
      : ["operator", "admin"];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage the people who can access your school.
          </p>
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

      {/* Invite user */}
      <details className="card mt-5">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-900">
          + Invite user
        </summary>
        <form
          action={inviteUser}
          className="grid gap-3 border-t border-slate-200 px-4 py-4 sm:grid-cols-2"
        >
          <div>
            <label htmlFor="full_name" className="field-label">Full name</label>
            <input
              id="full_name"
              name="full_name"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="role" className="field-label">Role</label>
            <select
              id="role"
              name="role"
              defaultValue="operator"
              className="field-input"
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="password" className="field-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="field-input"
            />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary">
              Create user
            </button>
          </div>
        </form>
      </details>

      {/* Table */}
      <div className="card mt-5 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Change role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  No users yet. Use <span className="font-medium">+ Invite user</span> to add one.
                </td>
              </tr>
            )}
            {rows.map((u) => {
              const isSelf = u.id === me.id;
              const isSuperAdmin = u.role === "super_admin";
              // Admins cannot touch super_admin rows.
              const canEditRow = me.role === "super_admin" || !isSuperAdmin;
              // Role options for this row: admins never see super_admin.
              const rowRoles: AppRole[] =
                me.role === "super_admin"
                  ? ["operator", "admin", "super_admin"]
                  : ["operator", "admin"];
              const showRemove = !isSelf && canEditRow;

              return (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {u.full_name ?? "—"}
                    {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ROLE_BADGE[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {canEditRow ? (
                      <form
                        action={setUserRole.bind(null, u.id)}
                        className="flex items-center gap-2"
                      >
                        <select
                          name="role"
                          defaultValue={rowRoles.includes(u.role) ? u.role : "operator"}
                          className="field-input w-auto"
                        >
                          {rowRoles.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <button className="btn-secondary btn-sm">
                          Save
                        </button>
                      </form>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {showRemove ? (
                      <form action={deleteUser.bind(null, u.id)} className="inline">
                        <button className="btn-danger btn-sm">Remove</button>
                      </form>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">{rows.length} user(s).</p>
    </div>
  );
}
