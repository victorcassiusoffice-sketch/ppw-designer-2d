/**
 * V4 M9.A.send.2 — dedup-key generator unit tests.
 */

import { describe, it, expect } from 'vitest';

import { computeDedupKey } from '../../../lib/email/dedupKey';

describe('computeDedupKey', () => {
  it('returns the same key for the same input', () => {
    const a = computeDedupKey('design-saved', 'c@example.com', { designId: 7 });
    const b = computeDedupKey('design-saved', 'c@example.com', { designId: 7 });
    expect(a).toBe(b);
  });

  it('returns different keys for different payloads', () => {
    const a = computeDedupKey('design-saved', 'c@example.com', { designId: 7 });
    const b = computeDedupKey('design-saved', 'c@example.com', { designId: 8 });
    expect(a).not.toBe(b);
  });

  it('treats nested payload key order as equivalent (stable stringify)', () => {
    const a = computeDedupKey('order-confirmed', 'c@example.com', { a: 1, b: { x: 2, y: 3 } });
    const b = computeDedupKey('order-confirmed', 'c@example.com', { b: { y: 3, x: 2 }, a: 1 });
    expect(a).toBe(b);
  });

  it('produces a 32-char hex string', () => {
    const k = computeDedupKey('design-saved', 'c@example.com', { x: 1 });
    expect(k).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(k)).toBe(true);
  });

  it('treats recipient case as equivalent (lowercases recipient before hashing)', () => {
    const a = computeDedupKey('design-saved', 'CUSTOMER@Example.com', { designId: 7 });
    const b = computeDedupKey('design-saved', 'customer@example.com', { designId: 7 });
    expect(a).toBe(b);
  });

  it('hashes different templates to different keys', () => {
    const a = computeDedupKey('design-saved', 'c@example.com', { designId: 7 });
    const b = computeDedupKey('order-confirmed', 'c@example.com', { designId: 7 });
    expect(a).not.toBe(b);
  });

  it('handles null + undefined payload deterministically', () => {
    const a = computeDedupKey('t', 'c@example.com', null);
    const b = computeDedupKey('t', 'c@example.com', undefined);
    expect(a).toBe(b);
  });
});
