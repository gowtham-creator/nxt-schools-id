"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  ScanLine,
  SearchX,
  ShieldAlert,
  User,
} from "lucide-react";
import type { PipelineStatus } from "@/lib/types";
import type { ScannedMember, ScanResult } from "@/lib/scan";
import { scanLookup } from "./actions";

/* Minimal typing for the native BarcodeDetector (not yet in lib.dom). */
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

function getDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

const PIPELINE_BADGE: Record<PipelineStatus, { label: string; cls: string }> = {
  not_generated: { label: "Not Generated", cls: "bg-slate-100 text-slate-500" },
  generated: { label: "Generated", cls: "bg-blue-50 text-blue-700" },
  print_approval_pending: { label: "Print Approval", cls: "bg-amber-50 text-amber-700" },
  sent_for_printing: { label: "Sent For Printing", cls: "bg-indigo-50 text-indigo-700" },
  printed: { label: "Printed", cls: "bg-emerald-50 text-emerald-700" },
};

interface RecentScan {
  at: string; // HH:MM:SS local
  name: string;
  identifier: string | null;
  ok: boolean;
}

function isExpired(member: ScannedMember): boolean {
  if (!member.valid_until) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${member.valid_until}T00:00:00`) < today;
}

export default function ScanClient() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // BarcodeDetector exists only in the browser — resolve it after mount so the
  // server and first client render agree (avoids a hydration mismatch).
  const [hasDetector, setHasDetector] = useState(false);
  const [pending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectingRef = useRef(false);

  useEffect(() => {
    setHasDetector(getDetectorCtor() != null);
  }, []);

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const doLookup = useCallback(
    (code: string) => {
      startTransition(async () => {
        const res = await scanLookup(code);
        setResult(res);
        setRecent((prev) =>
          [
            {
              at: new Date().toLocaleTimeString(),
              name: res.ok ? res.member.full_name : code,
              identifier: res.ok ? res.member.identifier : null,
              ok: res.ok,
            },
            ...prev,
          ].slice(0, 8),
        );
        if (inputRef.current) {
          inputRef.current.value = "";
          inputRef.current.focus();
        }
      });
    },
    [startTransition],
  );

  const startCamera = useCallback(async () => {
    const detectorCtor = getDetectorCtor();
    if (!detectorCtor) return;
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOn(true);
      // Let the <video> mount, then attach + start the detect loop.
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        void video.play();
        const detector = new detectorCtor({ formats: ["qr_code", "code_128"] });
        timerRef.current = setInterval(async () => {
          if (detectingRef.current || !videoRef.current) return;
          if (videoRef.current.readyState < 2) return;
          detectingRef.current = true;
          try {
            const codes = await detector.detect(videoRef.current);
            const hit = codes.find((c) => c.rawValue.trim().length > 0);
            if (hit) {
              stopCamera();
              doLookup(hit.rawValue);
            }
          } catch {
            // Detection hiccups (tab hidden, frame not ready) — keep looping.
          } finally {
            detectingRef.current = false;
          }
        }, 350);
      });
    } catch {
      setCameraError("Camera unavailable — check browser permissions.");
      stopCamera();
    }
  }, [doLookup, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const member = result?.ok ? result.member : null;
  const expired = member ? isExpired(member) : false;
  const inactive = member ? member.status !== "active" : false;
  const pass = member != null && !expired && !inactive;

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* Left: input + camera */}
      <div className="lg:col-span-2">
        <div className="card p-5">
          <label htmlFor="scan-code" className="field-label">
            Scan or enter code
          </label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const code = inputRef.current?.value ?? "";
              if (code.trim()) doLookup(code);
            }}
          >
            <input
              id="scan-code"
              ref={inputRef}
              type="text"
              autoFocus
              autoComplete="off"
              placeholder="QR / barcode / Admission No…"
              className="field-input"
            />
            <button type="submit" disabled={pending} className="btn-primary shrink-0">
              {pending ? "…" : "Look up"}
            </button>
          </form>
          <p className="field-hint">
            USB barcode scanners type here automatically — keep this box focused.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4">
            {hasDetector ? (
              cameraOn ? (
                <button onClick={stopCamera} className="btn-secondary btn-sm">
                  <CameraOff className="h-4 w-4" /> Stop camera
                </button>
              ) : (
                <button onClick={() => void startCamera()} className="btn-secondary btn-sm">
                  <Camera className="h-4 w-4" /> Scan with camera
                </button>
              )
            ) : (
              <p className="text-xs text-slate-400">
                Camera scanning needs Chrome/Edge. Use a USB scanner or type the ID.
              </p>
            )}
            {cameraError ? <p className="field-error">{cameraError}</p> : null}
            {cameraOn ? (
              <div className="relative mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                <video ref={videoRef} muted playsInline className="h-56 w-full object-cover" />
                <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-teal-400/80" />
              </div>
            ) : null}
          </div>
        </div>

        {/* Session log */}
        <div className="card mt-4 p-5">
          <h3 className="text-sm font-semibold text-slate-900">This session</h3>
          {recent.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No scans yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {recent.map((r, i) => (
                <li key={`${r.at}-${i}`} className="flex items-center gap-2 py-1.5 text-sm">
                  {r.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <SearchX className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span className="truncate font-medium text-slate-700">{r.name}</span>
                  {r.identifier ? (
                    <span className="text-xs text-slate-400">{r.identifier}</span>
                  ) : null}
                  <span className="ml-auto shrink-0 text-xs text-slate-400">{r.at}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right: result */}
      <div className="lg:col-span-3">
        {member ? (
          <div className="card overflow-hidden">
            <div
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white ${
                pass ? "bg-teal-700" : "bg-red-600"
              }`}
            >
              {pass ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
              {pass ? "Verified — card is valid" : expired ? "Card EXPIRED" : "Member INACTIVE"}
            </div>
            <div className="flex flex-wrap gap-5 p-5">
              {member.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.photo_url}
                  alt={member.full_name}
                  className="h-28 w-24 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                  <User className="h-8 w-8 text-slate-300" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900">{member.full_name}</h2>
                  <span
                    className={`badge ${
                      member.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {member.status}
                  </span>
                  <span className={`badge ${PIPELINE_BADGE[member.pipeline_status].cls}`}>
                    {PIPELINE_BADGE[member.pipeline_status].label}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-slate-400">Admission No</dt>
                    <dd className="font-medium text-slate-800">{member.identifier ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Class</dt>
                    <dd className="font-medium text-slate-800">
                      {member.class_name
                        ? `${member.class_name}${member.section ? ` · ${member.section}` : ""}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Type</dt>
                    <dd className="font-medium capitalize text-slate-800">{member.member_type}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Blood group</dt>
                    <dd className="font-semibold text-red-600">{member.blood_group ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Valid till</dt>
                    <dd className={`font-medium ${expired ? "text-red-600" : "text-slate-800"}`}>
                      {member.valid_until ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Branch</dt>
                    <dd className="font-medium text-slate-800">{member.branch ?? "—"}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <Link href={`/members/${member.id}/edit`} className="btn-secondary btn-sm">
                    Open member
                  </Link>
                  <button
                    onClick={() => {
                      setResult(null);
                      inputRef.current?.focus();
                    }}
                    className="btn-primary btn-sm"
                  >
                    Scan next
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : result && !result.ok ? (
          <div className="card flex items-center gap-3 border-red-200 bg-red-50/60 p-5">
            <SearchX className="h-6 w-6 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-red-700">{result.error}</p>
              <p className="text-xs text-red-500">Check the code and scan again.</p>
            </div>
          </div>
        ) : (
          <div className="card flex h-full min-h-56 flex-col items-center justify-center gap-2 border-dashed p-8 text-center">
            <ScanLine className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">
              Scan a card's QR or barcode to pull up the student.
            </p>
            <p className="text-xs text-slate-400">
              The result appears here with photo, class and validity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
