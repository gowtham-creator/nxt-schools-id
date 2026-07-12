import { redirect } from "next/navigation";
import { ROLE_LABELS } from "@/lib/constants";
import { getProfile } from "@/lib/auth";
import { getTrialStatus } from "@/lib/trial";
import type { AppRole } from "@/lib/types";
import NavLink from "./NavLink";

export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; roles?: AppRole[] }[] = [
  { href: "/platform", label: "Platform", roles: ["super_admin"] },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/branches", label: "Branches", roles: ["super_admin", "admin"] },
  { href: "/academic-years", label: "Academic Years", roles: ["super_admin", "admin"] },
  { href: "/members", label: "Members" },
  { href: "/scan", label: "Scan" },
  { href: "/templates", label: "Templates", roles: ["super_admin", "admin"] },
  { href: "/users", label: "Users", roles: ["super_admin", "admin"] },
  { href: "/audit", label: "Audit log", roles: ["super_admin", "admin"] },
  { href: "/settings", label: "Settings", roles: ["super_admin", "admin"] },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cached per request: shared with any page that calls getProfile()/requireRole().
  const { user, profile } = await getProfile();
  const role = profile.role;

  // Access lock: a school whose super-admin-assigned active-time budget is spent
  // is sent to the restricted screen (which then signs them out). Super admins
  // are never gated; schools with no limit return null (no gate).
  if (role !== "super_admin" && profile.school_id) {
    const trial = await getTrialStatus(profile.school_id);
    if (trial?.expired) redirect("/restricted");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
        <div className="px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/nxt-mark.png" alt="NXT School" className="h-9 w-auto" />
          <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            ID Card Suite
          </div>
        </div>
        <nav className="mt-6 space-y-1">
          {NAV.filter((n) => !n.roles || n.roles.includes(role)).map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-sm text-slate-500">
            {profile.full_name ?? user.email} ·{" "}
            <span className="font-medium text-slate-700">{ROLE_LABELS[role]}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn-secondary btn-sm">
              Sign out
            </button>
          </form>
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
