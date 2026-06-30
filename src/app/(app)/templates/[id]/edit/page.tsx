import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TemplateDesigner from "./TemplateDesigner";
import type { IdTemplate, School } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: template }, { data: school }] = await Promise.all([
    supabase.from("id_templates").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("schools")
      .select("id,name,short_name,logo_url,primary_color,secondary_color,academic_year")
      .limit(1)
      .maybeSingle(),
  ]);

  if (!template) notFound();

  return (
    <TemplateDesigner
      template={template as IdTemplate}
      school={(school ?? null) as Partial<School> | null}
    />
  );
}
