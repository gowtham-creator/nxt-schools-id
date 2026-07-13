import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import AutoRefresh from "../../AutoRefresh";

export const dynamic = "force-dynamic";

/** Compact "2h ago" relative time (computed server-side each request). */
function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

const ABSOLUTE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

type LoginEvent = {
  id: number;
  created_at: string;
  changes: { email?: string; role?: string } | null;
  school: { name: string | null } | null;
};

export default async function LoginActivityPage() {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();

  const [schoolsRes, usersRes, authRes, eventsRes] = await Promise.all([
    admin.from("schools").select("id, name, short_name"),
    admin.from("app_users").select("id, school_id, role"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin
      .from("audit_log")
      .select("id, created_at, changes, school:school_id(name)")
      .eq("action", "user.login")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(60),
  ]);

  const schools = (schoolsRes.data ?? []) as {
    id: string;
    name: string;
    short_name: string | null;
  }[];
  const appUsers = (usersRes.data ?? []) as {
    id: string;
    school_id: string | null;
    role: string;
  }[];
  const authById = new Map((authRes.data?.users ?? []).map((u) => [u.id, u]));
  const events = (eventsRes.data ?? []) as unknown as LoginEvent[];

  // Per-school last login: the most recent last_sign_in_at across its users.
  const schoolName = new Map(schools.map((s) => [s.id, s]));
  const lastBySchool = new Map<string, { email: string | null; at: string | null }>();
  for (const u of appUsers) {
    if (!u.school_id) continue;
    const au = authById.get(u.id);
    const at = au?.last_sign_in_at ?? null;
    const cur = lastBySchool.get(u.school_id);
    if (!cur || (at && (!cur.at || new Date(at) > new Date(cur.at)))) {
      lastBySchool.set(u.school_id, { email: au?.email ?? null, at });
    }
  }
  const rows = schools
    .map((s) => ({
      id: s.id,
      name: s.name,
      short: s.short_name,
      email: lastBySchool.get(s.id)?.email ?? null,
      at: lastBySchool.get(s.id)?.at ?? null,
    }))
    .sort((a, b) => {
      if (!a.at) return 1;
      if (!b.at) return -1;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

  const RECENT_MS = 15 * 60 * 1000;
  const activeNow = rows.filter(
    (r) => r.at && Date.now() - new Date(r.at).getTime() < RECENT_MS,
  ).length;

  return (
    <div>
      <AutoRefresh seconds={10} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Login activity</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live sign-ins across every school. Updates automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/audit" className="btn-secondary btn-sm">
            Full audit log
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="card mt-5 flex flex-wrap divide-y divide-slate-100 sm:divide-x sm:divide-y-0">
        <div className="min-w-[10rem] flex-1 px-5 py-4">
          <div className="text-2xl font-semibold tabular-nums text-slate-900">
            {schools.length}
          </div>
          <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            Schools
          </div>
        </div>
        <div className="min-w-[10rem] flex-1 px-5 py-4">
          <div className="text-2xl font-semibold tabular-nums text-emerald-600">
            {activeNow}
          </div>
          <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            Signed in (last 15 min)
          </div>
        </div>
        <div className="min-w-[10rem] flex-1 px-5 py-4">
          <div className="text-2xl font-semibold tabular-nums text-slate-900">
            {events.length}
          </div>
          <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            Recent sign-in events
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Live sign-in feed */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Recent sign-ins</h2>
          {events.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No sign-ins recorded yet. New logins will appear here live.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {events.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {e.school?.name ?? "Platform"}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {e.changes?.email ?? "—"}
                      {e.changes?.role && (
                        <span className="text-slate-400"> · {e.changes.role.replace("_", " ")}</span>
                      )}
                    </div>
                  </div>
                  <span
                    title={ABSOLUTE.format(new Date(e.created_at))}
                    className="shrink-0 whitespace-nowrap text-xs text-slate-400"
                  >
                    {relativeTime(e.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Per-school last login */}
        <div className="card overflow-hidden p-0">
          <div className="p-6 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">Schools by last login</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-2.5 font-medium">School</th>
                  <th className="px-4 py-2.5 font-medium">Last login</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const recent =
                    r.at && Date.now() - new Date(r.at).getTime() < RECENT_MS;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-6 py-2.5">
                        <Link
                          href={`/platform/${r.id}`}
                          className="font-medium text-slate-800 hover:text-teal-700"
                        >
                          {r.name}
                        </Link>
                        {r.email && (
                          <div className="truncate text-xs text-slate-400">{r.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                        <span title={r.at ? ABSOLUTE.format(new Date(r.at)) : ""}>
                          {relativeTime(r.at)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {recent ? (
                          <span className="badge bg-emerald-50 text-emerald-700">
                            Active
                          </span>
                        ) : r.at ? (
                          <span className="badge bg-slate-100 text-slate-500">Idle</span>
                        ) : (
                          <span className="badge bg-amber-50 text-amber-700">
                            Never logged in
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
