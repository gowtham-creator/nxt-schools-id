import Link from "next/link";
import { BulkPhotos } from "./BulkPhotos";

export const dynamic = "force-dynamic";

export default function BulkPhotosPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Bulk photo upload</h1>
          <p className="mt-1 text-sm text-slate-500">
            Name each file by Admission No or Roll No, e.g. NXT-2025-001.jpg. We match
            and attach automatically.
          </p>
        </div>
        <Link href="/members" className="text-sm text-slate-500 hover:underline">
          ← Back to members
        </Link>
      </div>
      <div className="mt-5">
        <BulkPhotos />
      </div>
    </div>
  );
}
