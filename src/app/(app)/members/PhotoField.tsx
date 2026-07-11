"use client";

import { useState, useTransition } from "react";
import { PhotoCapture } from "./PhotoCapture";
import { uploadMemberPhoto, removeMemberPhoto } from "./photo-actions";

type Props = {
  initialUrl?: string | null;
  /** Present when editing an existing member — enables server-side replace/remove. */
  memberId?: string | null;
};

/**
 * Circular photo control for MemberForm. Holds the current photo URL in a
 * hidden <input name="photo_url"> (so the form still submits photo_url). Both
 * "Upload file" and "Use webcam" go through PhotoCapture's crop step, so every
 * photo is adjusted to passport size (35×45) before it is uploaded — no raw,
 * un-cropped uploads. In edit mode the upload persists immediately.
 */
export function PhotoField({ initialUrl, memberId }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string>(initialUrl ?? "");
  const [error, setError] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function upload(blob: Blob, filename: string) {
    setError("");
    const fd = new FormData();
    fd.append("photo", blob, filename);
    if (memberId) fd.append("member_id", memberId);
    startTransition(async () => {
      try {
        const { url, error: uploadError } = await uploadMemberPhoto(fd);
        if (uploadError || !url) {
          setError(uploadError ?? "Upload failed");
          return;
        }
        setPhotoUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function remove() {
    setError("");
    setPhotoUrl(""); // instant feedback; server delete happens in edit mode
    if (!memberId) return;
    startTransition(async () => {
      try {
        const { ok, error: removeError } = await removeMemberPhoto(memberId);
        if (!ok) setError(removeError ?? "Could not remove photo");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove photo");
      }
    });
  }

  return (
    <div className="shrink-0 text-center">
      <input type="hidden" name="photo_url" value={photoUrl} />

      <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="photo" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-slate-400">
            No photo
          </span>
        )}
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-medium text-slate-600">
            Working…
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col items-center gap-2">
        {/* Both upload and camera route through the crop step. */}
        <PhotoCapture uploadSelf={false} onCaptured={(blob) => upload(blob, "photo.jpg")} />
        {photoUrl && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="cursor-pointer text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Remove photo
          </button>
        )}
        <p className="max-w-[13rem] text-xs text-slate-400">
          Upload or use the camera, then drag &amp; zoom to crop to passport size (35×45).
        </p>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
