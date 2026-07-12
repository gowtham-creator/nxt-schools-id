"use client";

import { useState, useTransition } from "react";
import { KeyRound, LogIn, Copy } from "lucide-react";
import { startImpersonation } from "../impersonation-actions";
import { resetSchoolLoginPassword } from "../credentials-actions";

export type LoginRow = {
  id: string;
  email: string;
  role: string;
  lastLogin: string;
};

/**
 * Super-admin access panel for a school: log in AS the school (impersonation,
 * keeping the super-admin session), see each login + last sign-in, and reset a
 * login's password to a fresh temporary one (shown once).
 */
export default function SchoolAccessPanel({
  schoolId,
  users,
}: {
  schoolId: string;
  users: LoginRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, string>>({});

  const reset = (userId: string) => {
    setBusyId(userId);
    startTransition(async () => {
      const r = await resetSchoolLoginPassword(userId, schoolId);
      if (r.password) setShown((s) => ({ ...s, [userId]: r.password as string }));
      setBusyId(null);
    });
  };

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-slate-900">Access &amp; credentials</h2>
      <p className="mt-1 text-xs text-slate-500">
        Log in as this school to check or fix issues without leaving your super-admin session.
        Passwords are stored hashed and can&rsquo;t be shown, so reset one to get a working login.
      </p>

      <form action={startImpersonation.bind(null, schoolId)} className="mt-4">
        <button className="btn-primary btn-sm">
          <LogIn className="h-4 w-4" />
          Log in as this school
        </button>
      </form>

      <div className="mt-5 divide-y divide-slate-100">
        {users.length === 0 && (
          <p className="text-sm text-slate-400">No logins exist for this school.</p>
        )}
        {users.map((u) => (
          <div key={u.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">{u.email}</div>
                <div className="text-xs text-slate-400">
                  <span className="capitalize">{u.role.replace("_", " ")}</span> · last login{" "}
                  {u.lastLogin}
                </div>
              </div>
              <button
                type="button"
                onClick={() => reset(u.id)}
                disabled={pending && busyId === u.id}
                className="btn-secondary btn-sm"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {pending && busyId === u.id ? "Resetting…" : "Reset password"}
              </button>
            </div>
            {shown[u.id] && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm">
                <span className="text-amber-800">New password:</span>
                <code className="font-mono font-semibold text-amber-900">{shown[u.id]}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(shown[u.id])}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                <span className="w-full text-xs text-amber-700">
                  Shown once — copy it now and share it with the school.
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
