/**
 * Phase 6 — cart-quote coupon wiring (pure extractor). The apply/validate
 * math is covered in coupons.test.ts; this guards the request-shape read.
 */

import { describe, it, expect } from 'vitest';
import { readCouponCode } from '../cart-quote';

describe('readCouponCode', () => {
  it('returns a trimmed code when present', () => {
    expect(readCouponCode({ coupon: '  SAVE10 ' })).toBe('SAVE10');
  });
  it('returns null when absent / blank / non-string', () => {
    expect(readCouponCode({})).toBeNull();
    expect(readCouponCode({ coupon: '   ' })).toBeNull();
    expect(readCouponCode({ coupon: 10 })).toBeNull();
    expect(readCouponCode(null)).toBeNull();
  });
});
