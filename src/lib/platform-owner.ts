/**
 * The protected platform OWNER — the root super admin (user@nxtschools.com).
 *
 * The owner can manage (suspend / remove) other super admins, but is itself
 * protected: no one, including other super admins, may suspend or remove the
 * owner. Super-admin management is owner-only.
 */
export const PLATFORM_OWNER_ID = "e81f75c1-6b74-438a-a16b-b17add508c5e";

/** True when the given user id is the protected platform owner. */
export function isPlatformOwner(userId: string | null | undefined): boolean {
  return !!userId && userId === PLATFORM_OWNER_ID;
}
