import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABLES = ["members", "id_templates", "generated_cards", "classes"] as const;
const LABELS = ["Members", "Templates", "Cards generated", "Classes"];

export default async function DashboardPage() {
  const supabase = await createClient();

  const counts = await Promise.all(
    TABLES.map(async (t) => {
      const { count } = await supabase
        .from(t)
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    }),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Overview of your school&apos;s ID card data.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {counts.map((value, i) => (
          <div
            key={LABELS[i]}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="text-3xl font-semibold text-slate-900">{value}</div>
            <div className="mt-1 text-sm text-slate-500">{LABELS[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
