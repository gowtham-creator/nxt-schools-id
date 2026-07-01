import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The set of auditable events. Keep in sync with the `logAudit` call sites and
 * the labels in `src/app/(app)/audit/page.tsx`.
 */
export type AuditAction =
  | "card.generated"
  | "card.status_changed"
  | "member.created"
  | "member.deleted"
  | "user.invited"
  | "user.role_changed"
  | "user.removed"
  | "template.created"
  | "template.deleted";

interface LogAuditArgs {
  schoolId: string | null;
  actorId: string | null;
  action: AuditAction;
  /** Logical entity kind, e.g. "member" | "user" | "template". */
  targetType?: string | null;
  /** Entity primary key (stored as text). */
  targetId?: string | null;
  /** Arbitrary JSON detail persisted to `audit_log.changes`. */
  meta?: Record<string, unknown> | null;
}

/**
 * Insert a single `audit_log` row.
 *
 * Column mapping (see supabase/migrations/0001_init.sql):
 *   schoolId   -> school_id
 *   actorId    -> actor_id
 *   action     -> action
 *   targetType -> entity_type   (omitted when null/undefined)
 *   targetId   -> entity_id     (omitted when null/undefined)
 *   meta       -> changes       (omitted when null/undefined)
 *
 * Accepts either the RLS server client or the service-role admin client.
 * Wrapped in try/catch so a logging failure can never break the primary action.
 */
export async function logAudit(
  supabase: SupabaseClient,
  { schoolId, actorId, action, targetType, targetId, meta }: LogAuditArgs,
): Promise<void> {
  try {
    const row: Record<string, unknown> = {
      school_id: schoolId,
      actor_id: actorId,
      action,
    };
    if (targetType != null) row.entity_type = targetType;
    if (targetId != null) row.entity_id = targetId;
    if (meta != null) row.changes = meta;

    await supabase.from("audit_log").insert(row);
  } catch {
    // Auditing is best-effort — never surface a logging error to the caller.
  }
}
