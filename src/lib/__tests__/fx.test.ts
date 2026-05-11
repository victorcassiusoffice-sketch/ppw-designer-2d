/**
 * FX module — Week 3 unit tests.
 *
 * Covers fetch success, fetch failure → fallback, malformed payload
 * → fallback, and the `convert` helper.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  fetchFxSnapshot,
  convert,
  FALLBACK_RATES_USD,
  type FxSnapshot,
} from '../fx';

const baseSnapshot: FxSnapshot = {
  fetchedAt: 0,
  rates: { ...FALLBACK_RATES_USD },
  fallback: true,
};

describe('fetchFxSnapshot', () => {
  it('parses a valid response', async () => {
    const fake = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { MUR: 46.5, EUR: 0.93, GBP: 0.8 } }),
    });
    const snap = await fetchFxSnapshot(fake as unknown as typeof fetch);
    expect(snap.fallback).toBe(false);
    expect(snap.rates.MUR).toBeCloseTo(46.5);
    expect(snap.rates.EUR).toBeCloseTo(0.93);
    expect(snap.rates.GBP).toBeCloseTo(0.8);
    expect(snap.rates.USD).toBe(1);
  });

  it('falls back when the response is malformed', async () => {
    const fake = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { MUR: 'forty-five' } }),
    });
    const snap = await fetchFxSnapshot(fake as unknown as typeof fetch);
    expect(snap.fallback).toBe(true);
    expect(snap.rates.MUR).toBe(FALLBACK_RATES_USD.MUR);
  });

  it('falls back when the network rejects', async () => {
    const fake = vi.fn().mockRejectedValue(new Error('offline'));
    const snap = await fetchFxSnapshot(fake as unknown as typeof fetch);
    expect(snap.fallback).toBe(true);
  });

  it('falls back when the response is not ok', async () => {
    const fake = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const snap = await fetchFxSnapshot(fake as unknown as typeof fetch);
    expect(snap.fallback).toBe(true);
  });

  it('falls back when fetch is unavailable', async () => {
    const snap = await fetchFxSnapshot(undefined);
    expect(snap.fallback).toBe(true);
  });
});

describe('convert', () => {
  it('returns the same amount when from === to', () => {
    expect(convert(100, 'USD', 'USD', baseSnapshot)).toBe(100);
  });

  it('converts USD → MUR at the snapshot rate', () => {
    expect(convert(10, 'USD', 'MUR', baseSnapshot)).toBeCloseTo(10 * 45, 4);
  });

  it('converts MUR → USD', () => {
    expect(convert(450, 'MUR', 'USD', baseSnapshot)).toBeCloseTo(10, 4);
  });

  it('converts via USD as the pivot currency (EUR → MUR)', () => {
    // 100 EUR / 0.92 = ~108.7 USD ; × 45 = ~4891.3 MUR
    const expected = (100 / 0.92) * 45;
    expect(convert(100, 'EUR', 'MUR', baseSnapshot)).toBeCloseTo(expected, 4);
  });
});
