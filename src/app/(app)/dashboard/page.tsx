import { createClient } from "@/lib/supabase/server";
import { getDashboardAnalytics } from "@/lib/analytics";
import type { PipelineStatus } from "@/lib/types";
import DashboardView, { type DashboardMetrics, type SetupFlags } from "./DashboardView";

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
        .select("school_id")
        .eq("id", user.id)
        .single()
    : { data: null };
  const schoolId = (profile?.school_id ?? null) as string | null;

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
  ] = await Promise.all([
    supabase
      .from("schools")
      .select("logo_url, phone, student_template_id")
      .limit(1)
      .maybeSingle()
      .then(
        (r) =>
          (r.data ?? null) as {
            logo_url: string | null;
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

  return <DashboardView metrics={metrics} analytics={analytics} setup={setup} />;
}
