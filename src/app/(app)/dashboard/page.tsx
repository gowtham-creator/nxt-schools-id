import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDashboardAnalytics, getPlatformAnalytics } from "@/lib/analytics";
import { getTrialStatus } from "@/lib/trial";
import type { AppRole, PipelineStatus } from "@/lib/types";
import DashboardView, { type DashboardMetrics, type SetupFlags } from "./DashboardView";
import PlatformDashboard from "./PlatformDashboard";

export const dynamic = "force-dynamic";

// Pipeline stages that count as "ID generated" (everything from generation onward).
const GENERATED_STATUSES: PipelineStatus[] = [
  "generated",
  "print_approval_pending",
  "sent_for_printing",
  "printed",
];
// Stages that count as "sent for printing" (sent + already printed).
const SENT_STATUSES: PipelineStatus[] = ["sent_for_printing", "printed"];

export default async function DashboardPage() {
  const supabase = await createClient();

  // Resolve the caller's school (mirrors the members ctx() helper) so the
  // analytics selects can be scoped explicitly on top of RLS.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("app_users")
        .select("school_id, role")
        .eq("id", user.id)
        .single()
    : { data: null };
  const schoolId = (profile?.school_id ?? null) as string | null;
  const role = (profile?.role ?? "operator") as AppRole;

  // Super admin: show LIVE platform-wide analytics across every school (not a
  // single tenant). Uses the service-role client — safe, this branch is
  // super_admin-only.
  if (role === "super_admin") {
    const platform = await getPlatformAnalytics(createAdminClient());
    return <PlatformDashboard data={platform} />;
  }

  // Fresh head-count query against members for each funnel filter.
  const members = () =>
    supabase.from("members").select("*", { count: "exact", head: true });

  const [
    school,
    totalBranches,
    totalStudents,
    imageUploaded,
    idGenerated,
    sentForPrinting,
    printed,
    analytics,
    callerLogoUrl,
  ] = await Promise.all([
    supabase
      .from("schools")
      .select("logo_url, signature_url, phone, student_template_id")
      .limit(1)
      .maybeSingle()
      .then(
        (r) =>
          (r.data ?? null) as {
            logo_url: string | null;
            signature_url: string | null;
            phone: string | null;
            student_template_id: string | null;
          } | null,
      ),
    supabase
      .from("branches")
      .select("*", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    members().then((r) => r.count ?? 0),
    members()
      .not("photo_url", "is", null)
      .then((r) => r.count ?? 0),
    members()
      .in("pipeline_status", GENERATED_STATUSES)
      .then((r) => r.count ?? 0),
    members()
      .in("pipeline_status", SENT_STATUSES)
      .then((r) => r.count ?? 0),
    members()
      .eq("pipeline_status", "printed")
      .then((r) => r.count ?? 0),
    getDashboardAnalytics(supabase, schoolId),
    // The caller's own school logo (by id) — drives the "upload your logo" prompt.
    schoolId
      ? supabase
          .from("schools")
          .select("logo_url")
          .eq("id", schoolId)
          .maybeSingle()
          .then((r) => (r.data?.logo_url ?? null) as string | null)
      : Promise.resolve<string | null>(null),
  ]);

  // Serializable snapshot of the exact values computed above.
  const metrics: DashboardMetrics = {
    branches: totalBranches,
    students: totalStudents,
    total: totalStudents,
    imageUploaded,
    idGenerated,
    sentForPrinting,
    printed,
  };

  // Onboarding checklist flags — which "Get started" steps are already done.
  const setup: SetupFlags = {
    branded: !!(school?.logo_url && school?.phone),
    templatesChosen: !!school?.student_template_id,
    studentsAdded: totalStudents > 0,
    cardsGenerated: idGenerated > 0,
  };

  // Prompt admins to upload a logo when their school has none yet. (Super admins
  // are handled by the platform-analytics branch above and never reach here.)
  const needsLogo = !callerLogoUrl && role === "admin";
  // Same prompt for the principal signature.
  const needsSignature = !school?.signature_url && role === "admin";

  // Excel/CSV import activity: how many imports were run and how many rows landed.
  const importRows = schoolId
    ? ((
        await supabase
          .from("audit_log")
          .select("changes, created_at")
          .eq("school_id", schoolId)
          .eq("action", "members.imported")
          .order("created_at", { ascending: false })
      ).data ?? [])
    : [];
  const importStats = {
    count: importRows.length,
    totalImported: importRows.reduce(
      (sum, r) =>
        sum + Number((r.changes as { imported?: number } | null)?.imported ?? 0),
      0,
    ),
    lastAt: importRows[0]?.created_at ?? null,
  };

  // Usage-based trial (only for trial schools — null otherwise). The (app)
  // layout already redirects expired trial schools away from here.
  const trial = schoolId ? await getTrialStatus(schoolId) : null;

  return (
    <DashboardView
      metrics={metrics}
      analytics={analytics}
      setup={setup}
      needsLogo={needsLogo}
      needsSignature={needsSignature}
      importStats={importStats}
      trial={trial}
    />
  );
}
