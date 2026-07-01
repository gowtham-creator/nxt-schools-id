import { createClient } from "@/lib/supabase/server";
import type { PipelineStatus } from "@/lib/types";
import DashboardView, { type DashboardMetrics } from "./DashboardView";

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

  // Fresh head-count query against members for each funnel filter.
  const members = () =>
    supabase.from("members").select("*", { count: "exact", head: true });

  const [
    totalBranches,
    totalStudents,
    imageUploaded,
    idGenerated,
    sentForPrinting,
    printed,
  ] = await Promise.all([
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

  return <DashboardView metrics={metrics} />;
}
