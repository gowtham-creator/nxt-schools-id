import { createClient } from "@/lib/supabase/server";
import { createBlankTemplate } from "./actions";
import TemplateCard from "./TemplateCard";
import type { IdTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: school }, { data: rows }] = await Promise.all([
    supabase.from("schools").select("logo_url").limit(1).maybeSingle(),
    supabase.from("id_templates").select("*").order("created_at", { ascending: false }),
  ]);
  const templates = (rows ?? []) as IdTemplate[];
  const logo = school?.logo_url ?? null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">ID Card Templates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Design the card layout — drag fields, photo, QR &amp; barcode onto a CR80 card.
          </p>
        </div>
        <form action={createBlankTemplate}>
          <button className="btn-primary">
            + New template
          </button>
        </form>
      </div>

      {sp.ok && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{sp.ok}</p>}
      {sp.error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>}

      {templates.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
          No templates yet. Click <span className="font-medium text-slate-600">+ New template</span> to design your first ID card.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} logo={logo} />
          ))}
        </div>
      )}
    </div>
  );
}
