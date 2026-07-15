import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_OWNER_ID } from "@/lib/platform-owner";
import AutoRefresh from "../../AutoRefresh";
import SuperAdminsManager, { type SuperAdminRow } from "./SuperAdminsManager";

export const dynamic = "force-dynamic";

/** Compact "2h ago" relative time. */
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
  return `${d}d ago`;
}

export default async function SuperAdminsPage() {
  const me = await requireRole(["super_admin"]);
  // Owner-only surface: a non-owner super admin can't manage super admins.
  if (me.id !== PLATFORM_OWNER_ID) redirect("/platform");

  const admin = createAdminClient();
  const [profilesRes, authRes] = await Promise.all([
    admin.from("app_users").select("id, full_name").eq("role", "super_admin"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const profiles = (profilesRes.data ?? []) as { id: string; full_name: string | null }[];
  const authById = new Map((authRes.data?.users ?? []).map((u) => [u.id, u]));
  const now = Date.now();

  const rows: SuperAdminRow[] = profiles
    .map((p) => {
      const au = authById.get(p.id);
      const bannedUntil = (au as { banned_until?: string | null } | undefined)?.banned_until;
      const suspended = !!bannedUntil && new Date(bannedUntil).getTime() > now;
      return {
        id: p.id,
        email: au?.email ?? "—",
        fullName: p.full_name,
        suspended,
        lastLogin: relativeTime(au?.last_sign_in_at ?? null),
        isOwner: p.id === PLATFORM_OWNER_ID,
      };
    })
    // Owner first, then the rest by email.
    .sort((a, b) => (a.isOwner ? -1 : b.isOwner ? 1 : a.email.localeCompare(b.email)));

  return (
    <div>
      <AutoRefresh seconds={15} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Super admins</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage platform super admins. Only you (the owner) can see and use this page;
            your account is protected and cannot be suspended or removed.
          </p>
        </div>
        <Link href="/platform" className="btn-secondary btn-sm">
          ← Platform
        </Link>
      </div>

      <SuperAdminsManager rows={rows} />

      <p className="mt-2 text-xs text-slate-400">
        Suspend blocks a super admin&rsquo;s login immediately (active sessions end within the
        hour). Remove permanently deletes their login. Both are reversible only by
        re-creating the account, except Suspend which you can Reactivate.
      </p>
    </div>
  );
}
