import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { getTrialStatus } from "@/lib/trial";
import AutoSignOut from "./AutoSignOut";

export const dynamic = "force-dynamic";

/** Seconds → "4h 0m". */
function human(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${m}m`;
}

export default async function RestrictedPage() {
  const { profile } = await getProfile();

  // Super admins are never restricted; don't strand a school that still has time.
  if (profile.role === "super_admin") redirect("/platform");
  const trial = profile.school_id ? await getTrialStatus(profile.school_id) : null;
  if (!trial || !trial.expired) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="card w-full max-w-md p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/nxt-mark.png" alt="NXT School" className="mx-auto h-9 w-auto" />
        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Access restricted</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your {human(trial.limit)} of access time has been used up. Access to NXT Schools
          ID Card Suite is paused. Please contact NXT Schools to renew your plan and restore
          access.
        </p>
        <a
          href="mailto:hello@nxtschools.com?subject=Renew%20NXT%20Schools%20ID%20Card%20access"
          className="btn-primary mt-6 w-full justify-center"
        >
          Contact NXT Schools
        </a>
        <form action="/auth/signout" method="post" className="mt-3">
          <button className="btn-secondary w-full justify-center">Sign out now</button>
        </form>
        <AutoSignOut seconds={300} />
      </div>
    </div>
  );
}
