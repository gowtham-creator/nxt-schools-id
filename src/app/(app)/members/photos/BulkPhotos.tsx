"use client";

import { useState, useTransition } from "react";
import { bulkUploadPhotos, type BulkUploadResult } from "./actions";

export function BulkPhotos() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    setFiles(picked);
    setResult(null);
    setError("");
  }

  function onUpload() {
    if (files.length === 0) return;
    setError("");
    setResult(null);
    const fd = new FormData();
    for (const file of files) fd.append("photos", file, file.name);
    startTransition(async () => {
      try {
        const res = await bulkUploadPhotos(fd);
        setResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="card p-5">
        <label htmlFor="photo-files" className="field-label">Photo files</label>
        <div className="mt-2">
          <label htmlFor="photo-files" className="btn-secondary btn-sm">
            Choose files
          </label>
        </div>
        <input
          id="photo-files"
          type="file"
          multiple
          accept="image/*"
          onChange={onPick}
          disabled={pending}
          className="hidden"
        />

        {files.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-slate-500">{files.length} file(s) selected</p>
            <ul className="mt-2 grid max-h-40 grid-cols-1 gap-x-4 gap-y-1 overflow-auto text-xs text-slate-600 sm:grid-cols-2">
              {files.map((f) => (
                <li key={f.name} className="truncate">
                  {f.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onUpload}
          disabled={pending || files.length === 0}
          className="mt-4 btn-primary"
        >
          {pending ? "Uploading…" : "Upload & match"}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {result && (
        <div className="card p-5">
          <p className="text-sm font-medium text-emerald-700">
            Matched {result.matched} of {result.total} file(s).
          </p>
          {result.unmatched.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-amber-700">
                Unmatched ({result.unmatched.length}):
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                {result.unmatched.map((name) => (
                  <li key={name} className="truncate">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
