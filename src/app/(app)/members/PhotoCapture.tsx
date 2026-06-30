"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { createClient } from "@/lib/supabase/client";

type Stage = "choose" | "camera" | "crop";

type PhotoCaptureProps = {
  /** Called with the public URL of the uploaded, cropped JPEG. */
  onUploaded: (publicUrl: string) => void;
  /** Storage bucket name. Defaults to "photos". */
  bucket?: string;
  className?: string;
};

// Passport portrait ratio (35mm x 45mm) expressed as width / height.
const PASSPORT_ASPECT = 35 / 45;
// Output dimensions of the cropped JPEG (portrait), ~300dpi for a 35x45mm photo.
const OUTPUT_WIDTH = 600;
const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / PASSPORT_ASPECT); // 771
const JPEG_QUALITY = 0.9;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Could not load image.")));
    img.src = src;
  });
}

/** Render `area` (source-pixel rect) of `imageSrc` into a portrait JPEG blob. */
async function cropToJpegBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (err.name === "NotAllowedError") return "Camera permission was denied.";
    if (err.name === "NotFoundError") return "No camera was found on this device.";
    if (err.name === "NotReadableError") return "The camera is already in use.";
    return err.message || fallback;
  }
  return fallback;
}

const btnPrimary =
  "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";
const btnGhost =
  "rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function PhotoCapture({ onUploaded, bucket = "photos", className }: PhotoCaptureProps) {
  const [stage, setStage] = useState<Stage>("choose");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Stop any live tracks on unmount.
  useEffect(() => stopCamera, [stopCamera]);

  const resetCropState = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Webcam capture is not supported in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setStage("camera");
    } catch (err) {
      setError(describeError(err, "Could not start the camera."));
    } finally {
      setBusy(false);
    }
  }, []);

  // Attach the stream once the <video> is mounted in the camera stage.
  useEffect(() => {
    const video = videoRef.current;
    if (stage !== "camera" || !video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    void video.play().catch(() => undefined);
  }, [stage]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Canvas is not supported in this browser.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setImageSrc(canvas.toDataURL("image/jpeg", 0.95));
    stopCamera();
    resetCropState();
    setStage("crop");
  }, [stopCamera, resetCropState]);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allow re-selecting the same file later
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file.");
        return;
      }
      setError("");
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          setError("Could not read the selected file.");
          return;
        }
        setImageSrc(reader.result);
        resetCropState();
        setStage("crop");
      };
      reader.onerror = () => setError("Could not read the selected file.");
      reader.readAsDataURL(file);
    },
    [resetCropState],
  );

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const reset = useCallback(() => {
    stopCamera();
    setImageSrc(null);
    resetCropState();
    setStage("choose");
  }, [stopCamera, resetCropState]);

  const confirm = useCallback(async () => {
    if (!imageSrc || !croppedArea) return;
    setBusy(true);
    setError("");
    try {
      const blob = await cropToJpegBlob(imageSrc, croppedArea);
      const supabase = createClient();
      const path = `${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onUploaded(data.publicUrl);
      reset();
    } catch (err) {
      setError(describeError(err, "Upload failed."));
    } finally {
      setBusy(false);
    }
  }, [imageSrc, croppedArea, bucket, onUploaded, reset]);

  return (
    <div className={className}>
      {stage === "choose" && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={startCamera} disabled={busy} className={btnPrimary}>
            {busy ? "Starting camera…" : "Use webcam"}
          </button>
          <label className={`${btnGhost} cursor-pointer`}>
            Upload file
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFile}
              disabled={busy}
            />
          </label>
        </div>
      )}

      {stage === "camera" && (
        <div className="space-y-3">
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-md bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-auto w-full"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={capture} className={btnPrimary}>
              Capture
            </button>
            <button type="button" onClick={reset} className={btnGhost}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {stage === "crop" && imageSrc && (
        <div className="space-y-3">
          <div className="relative mx-auto h-80 w-full max-w-sm overflow-hidden rounded-md bg-slate-100">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={PASSPORT_ASPECT}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
              aria-label="Zoom"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirm}
              disabled={busy || !croppedArea}
              className={btnPrimary}
            >
              {busy ? "Uploading…" : "Use photo"}
            </button>
            <button type="button" onClick={reset} disabled={busy} className={btnGhost}>
              Retake
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
