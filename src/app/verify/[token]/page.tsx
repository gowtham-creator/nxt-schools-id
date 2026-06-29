import { createClient } from "@/lib/supabase/server";
import type { CardVerification } from "@/lib/types";

export const dynamic = "force-dynamic";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-medium text-slate-800">{v}</dd>
    </div>
  );
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_card", { token });
  const card = (Array.isArray(data) ? data[0] : data) as
    | CardVerification
    | undefined;

  if (!card) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="text-lg font-semibold text-red-700">
            Invalid or expired ID
          </div>
          <p className="mt-2 text-sm text-slate-500">
            This card could not be verified.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-emerald-600 px-6 py-3 text-sm font-medium text-white">
          ✓ Verified ID
        </div>
        <div className="flex flex-col items-center p-6">
          {card.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.photo_url}
              alt={card.full_name}
              className="h-28 w-28 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-400">
              No photo
            </div>
          )}
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            {card.full_name}
          </h1>
          <p className="text-sm text-slate-500">{card.identifier}</p>
          <dl className="mt-4 w-full space-y-1 text-sm">
            <Row k="Type" v={card.member_type} />
            {card.class_name ? (
              <Row
                k="Class"
                v={`${card.class_name}${card.section ? " - " + card.section : ""}`}
              />
            ) : null}
            <Row k="School" v={card.school_name} />
            {card.valid_until ? <Row k="Valid until" v={card.valid_until} /> : null}
            <Row k="Status" v={card.status} />
          </dl>
        </div>
      </div>
    </main>
  );
}
