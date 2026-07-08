// Pure helpers for member photo URLs. Kept out of the "use server" action files
// (which may only export async server actions) so both can import them.

const PUBLIC_MARKER = "/storage/v1/object/public/photos/";

/**
 * Cache-busting version token appended to a stored photo URL. Each upload gets a
 * new token, so the browser and Supabase's Storage CDN treat a replaced photo as
 * a new URL and fetch it fresh instead of serving a stale cached copy — the fix
 * for "the old photo still shows after re-uploading".
 */
export function versionedPublicUrl(publicUrl: string): string {
  return `${publicUrl}?v=${crypto.randomUUID().slice(0, 8)}`;
}

/** The object path inside the `photos` bucket for a stored public URL (or null). */
export function photoPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const i = url.indexOf(PUBLIC_MARKER);
  if (i === -1) return null;
  const path = url.slice(i + PUBLIC_MARKER.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}
