import { describe, it, expect } from 'vitest';
import { aggregateOrderStatus, isValidTransition } from '../lib/order-status';

describe('aggregateOrderStatus', () => {
  it('returns pending for empty input', () => {
    expect(aggregateOrderStatus([])).toBe('pending');
  });

  it('returns failed if any item failed', () => {
    expect(aggregateOrderStatus(['delivered', 'failed', 'shipped'])).toBe('failed');
  });

  it('returns delivered if all delivered', () => {
    expect(aggregateOrderStatus(['delivered', 'delivered'])).toBe('delivered');
  });

  it('returns the lowest rank for mixed non-failed', () => {
    expect(aggregateOrderStatus(['delivered', 'shipped', 'confirmed'])).toBe('confirmed');
    expect(aggregateOrderStatus(['delivered', 'in_transit'])).toBe('in_transit');
    expect(aggregateOrderStatus(['shipped', 'in_transit'])).toBe('shipped');
  });

  it('handles single item', () => {
    expect(aggregateOrderStatus(['shipped'])).toBe('shipped');
  });

  it('returned beats confirmed (lower rank)', () => {
    expect(aggregateOrderStatus(['confirmed', 'returned'])).toBe('returned');
  });
});

describe('isValidTransition', () => {
  it('null → confirmed only', () => {
    expect(isValidTransition(null, 'confirmed')).toBe(true);
    expect(isValidTransition(null, 'shipped')).toBe(false);
  });

  it('confirmed → shipped/in_transit/delivered', () => {
    expect(isValidTransition('confirmed', 'shipped')).toBe(true);
    expect(isValidTransition('confirmed', 'delivered')).toBe(true);
    expect(isValidTransition('confirmed', 'in_transit')).toBe(true);
    expect(isValidTransition('confirmed', 'confirmed')).toBe(false);
  });

  it('shipped → in_transit/delivered', () => {
    expect(isValidTransition('shipped', 'in_transit')).toBe(true);
    expect(isValidTransition('shipped', 'delivered')).toBe(true);
    expect(isValidTransition('shipped', 'shipped')).toBe(false);
    expect(isValidTransition('shipped', 'confirmed')).toBe(false);
  });

  it('in_transit → delivered only', () => {
    expect(isValidTransition('in_transit', 'delivered')).toBe(true);
    expect(isValidTransition('in_transit', 'shipped')).toBe(false);
  });

  it('failed/returned can be set from anywhere', () => {
    expect(isValidTransition(null, 'failed')).toBe(true);
    expect(isValidTransition('confirmed', 'failed')).toBe(true);
    expect(isValidTransition('delivered', 'returned')).toBe(true);
    expect(isValidTransition('shipped', 'returned')).toBe(true);
  });

  it('delivered is terminal', () => {
    expect(isValidTransition('delivered', 'shipped')).toBe(false);
    expect(isValidTransition('delivered', 'confirmed')).toBe(false);
    expect(isValidTransition('delivered', 'returned')).toBe(true);
    expect(isValidTransition('delivered', 'failed')).toBe(true);
  });
});
