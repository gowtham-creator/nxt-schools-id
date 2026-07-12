"use client";

import { useEffect, useState } from "react";

/**
 * Counts down from `seconds` and then automatically signs the user out by
 * posting to /auth/signout. Used on the restricted-access screen so a locked-out
 * school is signed out shortly after the lock (and then can't sign back in).
 */
export default function AutoSignOut({ seconds = 300 }: { seconds?: number }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (left > 0) return;
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/auth/signout";
    document.body.appendChild(form);
    form.submit();
  }, [left]);

  const m = Math.floor(left / 60);
  const s = left % 60;
  return (
    <p className="mt-4 text-xs text-slate-400">
      You will be signed out automatically in{" "}
      <span className="font-mono font-semibold text-slate-500">
        {m}:{String(s).padStart(2, "0")}
      </span>
    </p>
  );
}
