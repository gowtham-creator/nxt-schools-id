import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";

interface CapturedInsert {
  table: string;
  row: Record<string, unknown>;
}

/** Fake client that records `.from(table).insert(row)` calls. */
function makeFakeClient(opts: { reject?: boolean } = {}): {
  client: SupabaseClient;
  captured: CapturedInsert[];
} {
  const captured: CapturedInsert[] = [];
  const client = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        captured.push({ table, row });
        return opts.reject
          ? Promise.reject(new Error("db down"))
          : Promise.resolve({ data: null, error: null });
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, captured };
}

describe("logAudit", () => {
  it("maps params onto the real audit_log columns", async () => {
    const { client, captured } = makeFakeClient();

    await logAudit(client, {
      schoolId: "s-1",
      actorId: "u-1",
      action: "member.created",
      targetType: "member",
      targetId: "m-42",
      meta: { first_name: "Asha" },
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].table).toBe("audit_log");
    expect(captured[0].row).toEqual({
      school_id: "s-1",
      actor_id: "u-1",
      action: "member.created",
      entity_type: "member",
      entity_id: "m-42",
      changes: { first_name: "Asha" },
    });
  });

  it("omits entity_type/entity_id/changes when null or undefined, but keeps null ids", async () => {
    const { client, captured } = makeFakeClient();

    await logAudit(client, {
      schoolId: null,
      actorId: null,
      action: "user.removed",
      targetType: null,
      meta: null,
    });

    expect(captured[0].row).toEqual({
      school_id: null,
      actor_id: null,
      action: "user.removed",
    });
    expect("entity_type" in captured[0].row).toBe(false);
    expect("entity_id" in captured[0].row).toBe(false);
    expect("changes" in captured[0].row).toBe(false);
  });

  it("never throws when the insert rejects", async () => {
    const { client } = makeFakeClient({ reject: true });

    await expect(
      logAudit(client, {
        schoolId: "s-1",
        actorId: "u-1",
        action: "card.generated",
        targetType: "member",
        targetId: "m-1",
      }),
    ).resolves.toBeUndefined();
  });

  it("never throws even when the client itself blows up synchronously", async () => {
    const broken = {
      from: () => {
        throw new Error("no client");
      },
    } as unknown as SupabaseClient;

    await expect(
      logAudit(broken, {
        schoolId: "s-1",
        actorId: "u-1",
        action: "template.deleted",
      }),
    ).resolves.toBeUndefined();
  });
});
