/**
 * Webhook idempotency helper backed by the `webhook_events` table.
 *
 * Used by api/paypal-webhook.ts (and future MIPS/MCB Juice webhooks).
 * The PayPal webhook receiver calls `recordWebhookEvent` BEFORE doing
 * any side-effects. If it returns `{alreadyProcessed: true}` the
 * receiver returns 200 immediately - this is PayPal's expected
 * idempotency contract (they retry on non-2xx).
 *
 * The unique constraint on (source, event_id) is what makes this safe
 * under concurrent lambda invocations. INSERT ... ON CONFLICT DO
 * NOTHING returns 0 rows when the constraint fires - that's our signal
 * the event was already recorded.
 */

import { getDb } from '../_db/client.js';
import { webhookEvents } from '../_db/schema.js';
import { sql } from 'drizzle-orm';

export interface DedupeResult {
  alreadyProcessed: boolean;
  /** The row id, only present when this call inserted the row. */
  rowId?: number;
}

/**
 * Record a webhook event. Returns `alreadyProcessed: true` if this
 * (source, event_id) pair has already been seen.
 */
export async function recordWebhookEvent(
  source: string,
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<DedupeResult> {
  if (!source || !eventId || !eventType) {
    throw new Error('recordWebhookEvent requires source, eventId, eventType');
  }
  const db = getDb();
  // Drizzle's typed insert + onConflictDoNothing + returning gives us the
  // row id on first insert, [] on conflict.
  const rows = await db
    .insert(webhookEvents)
    .values({
      source,
      eventId,
      eventType,
      payload: payload as object,
    })
    .onConflictDoNothing({
      target: [webhookEvents.source, webhookEvents.eventId],
    })
    .returning({ id: webhookEvents.id });
  if (rows.length === 0) {
    return { alreadyProcessed: true };
  }
  return { alreadyProcessed: false, rowId: rows[0].id };
}

/**
 * Mark a previously-recorded event as processed. Optional - the table
 * is primarily for idempotency, but flipping the flag lets us surface
 * "stuck" events in admin dashboards later.
 */
export async function markWebhookEventProcessed(
  rowId: number,
  errorMessage: string | null = null,
): Promise<void> {
  const db = getDb();
  await db.execute(
    sql`UPDATE webhook_events SET processed = ${errorMessage === null}, processing_error = ${errorMessage} WHERE id = ${rowId}`,
  );
}
