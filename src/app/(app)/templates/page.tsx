import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CardSide from "@/lib/card-render";
import { buildPreviewData } from "@/lib/designer/geometry";
import {
  createBlankTemplate,
  deleteTemplate,
  setDefaultTemplate,
  duplicateTemplate,
} from "./actions";
import type { IdTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

const THUMB_K = 2.4; // px per mm for thumbnails

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
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
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
            <div key={t.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-center bg-slate-100 p-4">
                <div className="overflow-hidden rounded shadow-sm ring-1 ring-slate-200">
                  <CardSide
                    side={t.front}
                    data={buildPreviewData(t.front, { logo })}
                    widthMm={t.width_mm}
                    heightMm={t.height_mm}
                    scale={THUMB_K}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-800">{t.name}</p>
                    {t.is_default && (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {t.width_mm}×{t.height_mm}mm · {t.front.elements.length + t.back.elements.length} elements
                  </p>
                </div>
                <Link
                  href={`/templates/${t.id}/edit`}
                  className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Edit
                </Link>
              </div>
              <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-xs">
                {!t.is_default && (
                  <form action={setDefaultTemplate.bind(null, t.id)}>
                    <button className="text-slate-600 hover:underline">Set default</button>
                  </form>
                )}
                <form action={duplicateTemplate.bind(null, t.id)}>
                  <button className="text-slate-600 hover:underline">Duplicate</button>
                </form>
                <form action={deleteTemplate.bind(null, t.id)} className="ml-auto">
                  <button className="text-red-600 hover:underline">Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
