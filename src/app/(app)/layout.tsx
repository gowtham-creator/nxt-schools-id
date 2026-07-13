import { redirect } from "next/navigation";
import { ROLE_LABELS } from "@/lib/constants";
import { getProfile } from "@/lib/auth";
import { getTrialStatus } from "@/lib/trial";
import { getImpersonation } from "@/lib/impersonation";
import type { AppRole } from "@/lib/types";
import AppShell from "./AppShell";

export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; roles?: AppRole[] }[] = [
  { href: "/platform", label: "Platform", roles: ["super_admin"] },
  { href: "/platform/activity", label: "Login activity", roles: ["super_admin"] },
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

  // Super admin "View as school": when impersonating, the live session is the
  // school's, but we skip the access lock so an expired school can still be
  // inspected/debugged.
  const impersonation = await getImpersonation();

  // Access lock: a school whose super-admin-assigned active-time budget is spent
  // is sent to the restricted screen (which then signs them out). Super admins
  // are never gated; schools with no limit return null (no gate).
  if (!impersonation && role !== "super_admin" && profile.school_id) {
    const trial = await getTrialStatus(profile.school_id);
    if (trial?.expired) redirect("/restricted");
  }

  const nav = NAV.filter((n) => !n.roles || n.roles.includes(role)).map((n) => ({
    href: n.href,
    label: n.label,
  }));

  return (
    <AppShell
      nav={nav}
      userLabel={profile.full_name ?? user.email ?? ""}
      roleLabel={ROLE_LABELS[role]}
      impersonation={impersonation ? { schoolName: impersonation.schoolName } : null}
    >
      {children}
    </AppShell>
  );
}
