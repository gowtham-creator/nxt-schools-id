"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { setSuperAdminAccess, removeSuperAdmin } from "../admin-actions";

export type SuperAdminRow = {
  id: string;
  email: string;
  fullName: string | null;
  suspended: boolean;
  lastLogin: string;
  isOwner: boolean;
};

/**
 * Owner-only management of super admins. The owner row is shown as protected
 * (no actions). Every other super admin can be suspended/reactivated or removed.
 */
export default function SuperAdminsManager({ rows }: { rows: SuperAdminRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [, startTransition] = useTransition();

  const run = (id: string, fn: () => Promise<{ ok: boolean; error: string | null }>, okMsg: string) => {
    setPendingId(id);
    setConfirmRemove(null);
    startTransition(async () => {
      const r = await fn();
      setNote(r.ok ? okMsg : r.error ?? "Action failed.");
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <div className="card mt-5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Super admin</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const busy = pendingId === r.id;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{r.email}</div>
                    <div className="text-xs text-slate-400">
                      {r.fullName ?? "Super Admin"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.lastLogin}</td>
                  <td className="px-4 py-3">
                    {r.isOwner ? (
                      <span className="badge inline-flex items-center gap-1 bg-teal-50 text-teal-700">
                        <ShieldCheck className="h-3.5 w-3.5" /> Owner · protected
                      </span>
                    ) : r.suspended ? (
                      <span className="badge bg-rose-50 text-rose-700">Suspended</span>
                    ) : (
                      <span className="badge bg-emerald-50 text-emerald-700">Active</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {r.isOwner ? (
                      <span className="text-xs text-slate-400">You — cannot be changed</span>
                    ) : busy ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-3">
                        {r.suspended ? (
                          <button
                            type="button"
                            onClick={() => run(r.id, () => setSuperAdminAccess(r.id, false), "Reactivated.")}
                            className="cursor-pointer text-sm font-medium text-teal-700 hover:text-teal-800"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => run(r.id, () => setSuperAdminAccess(r.id, true), "Suspended.")}
                            className="cursor-pointer text-sm font-medium text-slate-500 hover:text-rose-600"
                          >
                            Suspend
                          </button>
                        )}
                        {confirmRemove === r.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-xs text-slate-500">Remove?</span>
                            <button
                              type="button"
                              onClick={() => run(r.id, () => removeSuperAdmin(r.id), "Removed.")}
                              className="cursor-pointer text-sm font-medium text-rose-600 hover:text-rose-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(null)}
                              className="cursor-pointer text-sm text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(r.id)}
                            className="cursor-pointer text-sm font-medium text-slate-400 hover:text-rose-600"
                          >
                            Remove
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {note && <p className="px-4 py-2 text-xs text-slate-500">{note}</p>}
    </div>
  );
}
