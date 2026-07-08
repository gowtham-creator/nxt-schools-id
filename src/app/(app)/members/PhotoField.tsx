"use client";

import { useState, useTransition } from "react";
import { PhotoCapture } from "./PhotoCapture";
import { uploadMemberPhoto, removeMemberPhoto } from "./photo-actions";

type Props = {
  initialUrl?: string | null;
  /** Present when editing an existing member — enables server-side replace/remove. */
  memberId?: string | null;
};

/** Client-side upload guard: 2 MB max, JPG/PNG only (mirrors the server action). */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];

/**
 * Circular photo control for MemberForm. Holds the current photo URL in a
 * hidden <input name="photo_url"> (so the form still submits photo_url), and
 * lets the user upload a file or capture from the webcam. When `memberId` is
 * set (edit mode) uploads persist immediately and Remove deletes server-side.
 */
export function PhotoField({ initialUrl, memberId }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string>(initialUrl ?? "");
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function upload(file: Blob, filename: string) {
    setError("");
    const fd = new FormData();
    fd.append("photo", file, filename);
    if (memberId) fd.append("member_id", memberId);
    startTransition(async () => {
      try {
        const { url, error: uploadError } = await uploadMemberPhoto(fd);
        if (uploadError || !url) {
          setError(uploadError ?? "Upload failed");
          return;
        }
        setPhotoUrl(url);
        setShowCamera(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function remove() {
    setError("");
    // Clear the field immediately for a responsive feel; delete server-side too
    // when we know the member (edit mode).
    setPhotoUrl("");
    setShowCamera(false);
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

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please choose a JPG or PNG image");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photo must be under 2 MB");
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
        <label className={`btn-secondary btn-sm ${pending ? "opacity-50" : ""}`}>
          {pending ? "Working…" : photoUrl ? "Change photo" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={onFile}
            disabled={pending}
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCamera((v) => !v)}
            disabled={pending}
            className="btn-ghost btn-sm"
          >
            {showCamera ? "Close camera" : "Use camera"}
          </button>
          {photoUrl && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="btn-sm cursor-pointer text-sm font-medium text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">Passport size (35×45), JPG/PNG, max 2 MB.</p>
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
