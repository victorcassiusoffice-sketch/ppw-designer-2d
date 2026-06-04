/**
 * P3-2 — paint estimate flag is OFF by default, ON only for ?paint=1.
 */
import { describe, it, expect } from 'vitest';
import { isPaintEstimateActive } from '../paintEstimateFlag';

describe('isPaintEstimateActive', () => {
  it('is OFF by default (no param)', () => {
    expect(isPaintEstimateActive('')).toBe(false);
  });
  it('is OFF for unrelated params', () => {
    expect(isPaintEstimateActive('?ui=gaming-v1')).toBe(false);
  });
  it('is ON for ?paint=1', () => {
    expect(isPaintEstimateActive('?paint=1')).toBe(true);
  });
  it('is OFF for ?paint=0 or other values', () => {
    expect(isPaintEstimateActive('?paint=0')).toBe(false);
    expect(isPaintEstimateActive('?paint=yes')).toBe(false);
  });
});
