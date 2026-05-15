/**
 * Unit tests for api/lib/webhookDedupe.ts
 *
 * The Drizzle query builder is mocked so we don't hit Neon. We verify
 * the call shape: insert ... onConflictDoNothing returning {id}.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const returningSpy = vi.fn();
const onConflictSpy = vi.fn().mockReturnValue({ returning: returningSpy });
const valuesSpy = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictSpy });
const insertSpy = vi.fn().mockReturnValue({ values: valuesSpy });
const executeSpy = vi.fn().mockResolvedValue([]);

vi.mock('../db/client', () => ({
  getDb: () => ({
    insert: insertSpy,
    execute: executeSpy,
  }),
}));

import { recordWebhookEvent, markWebhookEventProcessed } from '../lib/webhookDedupe';

beforeEach(() => {
  insertSpy.mockClear();
  valuesSpy.mockClear();
  onConflictSpy.mockClear();
  returningSpy.mockReset();
  executeSpy.mockClear();
});

describe('recordWebhookEvent', () => {
  it('returns alreadyProcessed:false + rowId on first insert', async () => {
    returningSpy.mockResolvedValue([{ id: 42 }]);
    const r = await recordWebhookEvent('paypal', 'EVT-1', 'PAYMENT.CAPTURE.COMPLETED', { foo: 'bar' });
    expect(r.alreadyProcessed).toBe(false);
    expect(r.rowId).toBe(42);
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'paypal',
        eventId: 'EVT-1',
        eventType: 'PAYMENT.CAPTURE.COMPLETED',
      }),
    );
  });
  it('returns alreadyProcessed:true when the unique constraint fires', async () => {
    returningSpy.mockResolvedValue([]);
    const r = await recordWebhookEvent('paypal', 'EVT-1', 'PAYMENT.CAPTURE.COMPLETED', {});
    expect(r.alreadyProcessed).toBe(true);
    expect(r.rowId).toBeUndefined();
  });
  it('throws when source/eventId/eventType missing', async () => {
    await expect(recordWebhookEvent('', 'x', 'y', {})).rejects.toThrow();
    await expect(recordWebhookEvent('paypal', '', 'y', {})).rejects.toThrow();
    await expect(recordWebhookEvent('paypal', 'x', '', {})).rejects.toThrow();
  });
});

describe('markWebhookEventProcessed', () => {
  it('writes success path (processed=true, error=null)', async () => {
    await markWebhookEventProcessed(7);
    expect(executeSpy).toHaveBeenCalled();
  });
  it('writes failure path (error message)', async () => {
    await markWebhookEventProcessed(7, 'boom');
    expect(executeSpy).toHaveBeenCalled();
  });
});
