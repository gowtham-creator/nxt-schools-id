import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

/** The signed-in user's app_users profile plus the auth user. */
export interface Profile {
  id: string;
  role: AppRole;
  school_id: string | null;
  full_name: string | null;
}

/**
 * Resolve the current auth user and their app_users profile.
 * Redirects to /login when there is no session.
 */
export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("app_users")
    .select("id, role, school_id, full_name")
    .eq("id", user.id)
    .single();

  const profile: Profile = {
    id: user.id,
    role: (data?.role ?? "operator") as AppRole,
    school_id: (data?.school_id ?? null) as string | null,
    full_name: (data?.full_name ?? null) as string | null,
  };

  return { user, profile };
}

/**
 * Ensure the current user holds one of `roles`.
 * Redirects to /dashboard?error=Forbidden otherwise. Returns the profile.
 */
export async function requireRole(roles: AppRole[]) {
  const { profile } = await getProfile();
  if (!roles.includes(profile.role)) {
    redirect("/dashboard?error=Forbidden");
  }
  return profile;
}

/** Roles allowed to manage other users. */
export function canManageUsers(role: AppRole): boolean {
  return role === "super_admin" || role === "admin";
}
