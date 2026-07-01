"use client";

import { useState, useTransition } from "react";
import { PhotoCapture } from "./PhotoCapture";
import { uploadMemberPhoto } from "./photo-actions";

type Props = {
  initialUrl?: string | null;
};

/**
 * Circular photo control for MemberForm. Holds the current photo URL in a
 * hidden <input name="photo_url"> (so the form still submits photo_url), and
 * lets the user upload a file or capture from the webcam. Both paths produce a
 * Blob/File that is uploaded via the uploadMemberPhoto server action.
 */
export function PhotoField({ initialUrl }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string>(initialUrl ?? "");
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function upload(file: Blob, filename: string) {
    setError("");
    const fd = new FormData();
    fd.append("photo", file, filename);
    startTransition(async () => {
      try {
        const { url } = await uploadMemberPhoto(fd);
        setPhotoUrl(url);
        setShowCamera(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    upload(file, file.name);
  }

  return (
    <div className="shrink-0 text-center">
      <input type="hidden" name="photo_url" value={photoUrl} />

      <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="photo" className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center text-xs text-slate-400">No photo</span>
        )}
      </div>

      <div className="mt-3 flex flex-col items-center gap-1.5">
        <label
          className={`inline-block cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 ${
            pending ? "opacity-50" : ""
          }`}
        >
          {pending ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
            disabled={pending}
          />
        </label>
        <button
          type="button"
          onClick={() => setShowCamera((v) => !v)}
          disabled={pending}
          className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {showCamera ? "Close camera" : "Use camera"}
        </button>
      </div>

      {showCamera && (
        <div className="mt-3">
          <PhotoCapture
            uploadSelf={false}
            onCaptured={(blob) => upload(blob, "capture.jpg")}
          />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
