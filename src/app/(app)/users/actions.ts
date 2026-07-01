"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import type { AppRole } from "@/lib/types";

const ROLES: AppRole[] = ["super_admin", "admin", "operator"];

function asRole(value: FormDataEntryValue | null): AppRole {
  const s = String(value ?? "");
  return (ROLES.includes(s as AppRole) ? s : "operator") as AppRole;
}

export async function inviteUser(fd: FormData) {
  const me = await requireRole(["super_admin", "admin"]);

  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const full_name = String(fd.get("full_name") ?? "").trim();
  const role = asRole(fd.get("role"));

  if (!email || !password) {
    redirect("/users?error=" + encodeURIComponent("Email and password are required"));
  }
  if (me.role === "admin" && role === "super_admin") {
    throw new Error("Admins cannot create super admins");
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) {
    redirect("/users?error=" + encodeURIComponent(error.message));
  }

  const { error: updateError } = await admin
    .from("app_users")
    .update({ role, school_id: me.school_id, full_name })
    .eq("id", data.user.id);
  if (updateError) {
    redirect("/users?error=" + encodeURIComponent(updateError.message));
  }

  revalidatePath("/users");
  redirect("/users?ok=User+created");
}

export async function setUserRole(id: string, roleOrFd: AppRole | FormData) {
  const me = await requireRole(["super_admin", "admin"]);

  // Supports two call styles: setUserRole(id, "admin") for direct calls, and
  // the bound-form style setUserRole.bind(null, id) where the second arg is the
  // submitted FormData carrying a `role` field.
  const role: AppRole =
    roleOrFd instanceof FormData ? asRole(roleOrFd.get("role")) : roleOrFd;

  const admin = createAdminClient();

  if (me.role === "admin") {
    if (role === "super_admin") {
      throw new Error("Admins cannot grant super admin");
    }
    const { data: target } = await admin
      .from("app_users")
      .select("role")
      .eq("id", id)
      .single();
    if ((target?.role as AppRole | undefined) === "super_admin") {
      throw new Error("Admins cannot edit a super admin");
    }
  }

  const { error } = await admin.from("app_users").update({ role }).eq("id", id);
  if (error) {
    redirect("/users?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/users");
  redirect("/users?ok=Role+updated");
}

export async function deleteUser(id: string) {
  const me = await requireRole(["super_admin", "admin"]);
  if (id === me.id) {
    throw new Error("You cannot remove yourself");
  }

  const admin = createAdminClient();

  if (me.role === "admin") {
    const { data: target } = await admin
      .from("app_users")
      .select("role")
      .eq("id", id)
      .single();
    if ((target?.role as AppRole | undefined) === "super_admin") {
      throw new Error("Admins cannot remove a super admin");
    }
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    redirect("/users?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/users");
  redirect("/users?ok=User+removed");
}
