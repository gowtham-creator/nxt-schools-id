/**
 * Route-group loading skeleton. Shown instantly on navigation while the dynamic
 * server render streams in, so the app feels responsive rather than blank.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 rounded-md bg-slate-200" />
      <div className="mt-2 h-4 w-72 rounded bg-slate-100" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-24 p-5">
            <div className="h-6 w-16 rounded bg-slate-200" />
            <div className="mt-3 h-3 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="card mt-6 overflow-hidden">
        <div className="h-11 bg-slate-50" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-slate-100 px-4 py-3">
            <div className="h-8 w-8 rounded-full bg-slate-200" />
            <div className="h-4 flex-1 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
