import ScanClient from "./ScanClient";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Scan station</h1>
      <p className="mt-1 text-sm text-slate-500">
        Scan a card's QR or barcode — with the camera, a USB scanner, or by
        typing the admission number — to instantly verify and open the member.
      </p>
      <ScanClient />
    </div>
  );
}
