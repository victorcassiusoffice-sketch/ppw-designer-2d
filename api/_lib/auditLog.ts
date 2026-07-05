/**
 * Append-only audit trail for admin-initiated actions.
 *
 * Every approve/reject/payout/suspend mutation writes a row here so we
 * can answer "who did what, when, why" without trawling Vercel logs.
 * Phase 2 surfaces the feed in the admin UI; Phase 4+ uses the same
 * table for compliance evidence.
 *
 * The function never throws — audit failures must NOT block the
 * primary action (Vic clicking Approve should always succeed even if
 * the audit insert fails, because we'd rather have the merchant
 * approved than blocked on telemetry). Failures are surfaced via the
 * returned `{ ok: boolean }` shape and logged.
 */

import { getDb, schema } from '../_db/client.js';

export interface AuditEntry {
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface AuditWriter {
  record(entry: AuditEntry): Promise<{ ok: true } | { ok: false; error: string }>;
}

/** Production-wired writer that inserts into Postgres via Drizzle. */
export function drizzleAuditWriter(): AuditWriter {
  return {
    async record(entry) {
      try {
        const db = getDb();
        await db.insert(schema.auditLog).values({
          actorEmail: entry.actorEmail,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          reason: entry.reason ?? null,
          payload: entry.payload ?? null,
        });
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'audit insert failed';
        // eslint-disable-next-line no-console
        console.error('[auditLog] insert failed', { entry, err: msg });
        return { ok: false, error: msg };
      }
    },
  };
}

/**
 * Module-level singleton used by handlers + adminMerchantActions.
 * Tests inject their own writer via `setAuditWriter(...)`.
 */
let writer: AuditWriter = drizzleAuditWriter();

export function setAuditWriter(w: AuditWriter): void {
  writer = w;
}

export function resetAuditWriter(): void {
  writer = drizzleAuditWriter();
}

export async function recordAudit(
  actorEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  reason?: string | null,
  payload?: Record<string, unknown> | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return writer.record({ actorEmail, action, targetType, targetId, reason, payload });
}

/** In-memory writer for tests — exposes a `.entries` array. */
export function createInMemoryAuditWriter(): AuditWriter & { entries: AuditEntry[]; reset(): void } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    reset() {
      entries.length = 0;
    },
    async record(entry) {
      entries.push({ ...entry });
      return { ok: true };
    },
  };
}
