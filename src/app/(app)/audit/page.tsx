import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** One row from `audit_log`, with the actor name joined from `app_users`. */
type AuditRow = {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string | null } | null;
};

/** Human labels + badge colors per audit action (falls back for unknown ones). */
const ACTION_META: Record<string, { label: string; className: string }> = {
  "card.generated": { label: "Card generated", className: "bg-teal-50 text-teal-700" },
  "card.status_changed": { label: "Card status changed", className: "bg-teal-50 text-teal-700" },
  "member.created": { label: "Member created", className: "bg-emerald-50 text-emerald-700" },
  "member.deleted": { label: "Member deleted", className: "bg-red-50 text-red-700" },
  "user.invited": { label: "User invited", className: "bg-blue-50 text-blue-700" },
  "user.role_changed": { label: "Role changed", className: "bg-blue-50 text-blue-700" },
  "user.removed": { label: "User removed", className: "bg-red-50 text-red-700" },
  "template.created": { label: "Template created", className: "bg-violet-50 text-violet-700" },
  "template.deleted": { label: "Template deleted", className: "bg-red-50 text-red-700" },
};

function actionMeta(action: string): { label: string; className: string } {
  return ACTION_META[action] ?? { label: action, className: "bg-slate-100 text-slate-600" };
}

/** Compact "2h ago" style relative time (computed server-side on each request). */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
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
});

/** Flatten primitive `changes` values into a "key: value · key: value" line. */
function summarizeChanges(changes: Record<string, unknown> | null): string {
  if (!changes) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(changes)) {
    if (v == null) continue;
    if (Array.isArray(v)) parts.push(`${k}: ${v.length}`);
    else if (typeof v === "object") continue;
    else parts.push(`${k}: ${String(v)}`);
  }
  return parts.join(" · ");
}

export default async function AuditPage() {
  const me = await requireRole(["super_admin", "admin"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id, action, entity_type, entity_id, changes, created_at, actor:actor_id(full_name)",
    )
    .eq("school_id", me.school_id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as AuditRow[];

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit log</h1>
        <p className="mt-1 text-sm text-slate-500">
          The 100 most recent actions taken across your school.
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </p>
      )}

      <div className="card mt-5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Target / details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                  No activity recorded yet. Actions like generating cards, editing
                  members and managing users will appear here.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const meta = actionMeta(row.action);
              const details = summarizeChanges(row.changes);
              return (
                <tr key={row.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    <span title={ABSOLUTE.format(new Date(row.created_at))}>
                      {relativeTime(row.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {row.actor?.full_name ?? (
                      <span className="text-slate-400">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${meta.className}`}>{meta.label}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex flex-col gap-0.5">
                      {row.entity_type && (
                        <span>
                          <span className="text-slate-500">{row.entity_type}</span>
                          {row.entity_id && (
                            <span className="ml-1.5 font-mono text-xs text-slate-400">
                              {row.entity_id.slice(0, 8)}
                            </span>
                          )}
                        </span>
                      )}
                      {details && (
                        <span className="text-xs text-slate-500">{details}</span>
                      )}
                      {!row.entity_type && !details && (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Showing {rows.length} event{rows.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
