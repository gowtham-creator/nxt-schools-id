import { Clock } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { getTrialStatus, trialLimitFor } from "@/lib/trial";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Seconds → "4h 0m". */
function human(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${m}m`;
}

export default async function TrialExpiredPage() {
  const { profile } = await getProfile();

  // If this school isn't actually out of trial time, don't strand them here.
  if (trialLimitFor(profile.school_id) == null) redirect("/dashboard");
  const status = profile.school_id ? await getTrialStatus(profile.school_id) : null;
  if (status && !status.expired) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="card w-full max-w-md p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/nxt-mark.png" alt="NXT School" className="mx-auto h-9 w-auto" />
        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <Clock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Trial time used up</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your {status ? human(status.limit) : "4h 0m"} free trial of NXT Schools ID Card
          Suite has ended. To keep creating and printing ID cards, please contact NXT
          Schools to activate your full plan.
        </p>
        <a
          href="mailto:hello@nxtschools.com?subject=Activate%20NXT%20Schools%20ID%20Card%20Suite"
          className="btn-primary mt-6 w-full justify-center"
        >
          Contact NXT Schools
        </a>
        <form action="/auth/signout" method="post" className="mt-3">
          <button className="btn-secondary w-full justify-center">Sign out</button>
        </form>
      </div>
    </div>
  );
}
