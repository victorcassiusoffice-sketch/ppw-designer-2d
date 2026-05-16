/**
 * Tests for src/lib/customerIdentity.ts — the email-based identity
 * cache used by M1.C.6 cloud-save + M1.C.7 Request Quote. Pure logic
 * (the localStorage path is guarded so the node env doesn't trip).
 */

import { describe, it, expect } from 'vitest';
import { isLikelyEmail } from '../customerIdentity';

describe('customerIdentity — isLikelyEmail', () => {
  it.each([
    ['vic@ppwellness.co', true],
    ['user+tag@example.com', true],
    ['a@b.cd', true],
    ['no-at.example.com', false],
    ['two@@example.com', false],
    ['missing-domain@', false],
    ['@missing-local.com', false],
    ['plain', false],
    ['', false],
    ['white space@x.com', false],
  ])('returns %p → %p', (input, expected) => {
    expect(isLikelyEmail(input)).toBe(expected);
  });
});
