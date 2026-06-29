import Link from "next/link";
import { ImportClient } from "./ImportClient";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Import members</h1>
          <p className="mt-1 text-sm text-slate-500">
            Bulk-add students &amp; staff from a CSV or Excel sheet.
          </p>
        </div>
        <Link href="/members" className="text-sm text-slate-500 hover:underline">
          ← Back to members
        </Link>
      </div>
      <div className="mt-5">
        <ImportClient />
      </div>
    </div>
  );
}
